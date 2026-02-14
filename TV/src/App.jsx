import React from "react";
import { createRoot } from "react-dom/client";
import { CSVLink } from "react-csv";
import QRCode from "qrcode";
import jsQR from "jsqr";
import {
  Font,
  StyleSheet,
  PDFViewer,
  Page,
  Image,
  View,
  Document,
  Text
} from "@react-pdf/renderer";
import ExecutionEnvironment from "exenv";
import firebase from "./init-firebase.js";
import {
  getFirestore,
  collection,
  doc,
  onSnapshot,
  getDoc,
  setDoc,
  query,
  where,
  updateDoc,
  addDoc,
  deleteDoc,
  orderBy,
  limit,
  limitToLast
} from "firebase/firestore";
import {
  signInWithPopup,
  OAuthProvider,
  getAuth,
  onAuthStateChanged,
  signOut,
  setPersistence
} from "firebase/auth";
import "./styles.css";
export const standardCatch = (err, title) =>
  console.log(title || "err-msg:", err.message);

const loginInitial = {
  sentCode: null,
  authError: "",
  eventsError: "",
  leadersError: "",
  newAccount: null,
  bumpedFrom: "this page",
  //name: "",
  id: "",
  under13: false,
  textedCode: "",
  alertExistingUser: false,
  recaptchaResponse: "",
  searchId: ""
};
const firestore = getFirestore(firebase);
export default class App extends React.Component {
  constructor(props) {
    super(props);
    var storedAuth = undefined;
    window.meAuth = undefined;
    this.state = {
      ...loginInitial,
      leadersFormatted: [],
      leaders: [],
      events: [],
      users: [],
      auth: undefined,
      user: undefined,
      loading: true,
      meAuth: {},
      storedAuth,
      activeAdminTab: "events"
    };
    window.recaptchaId = "";
    this.ra = React.createRef();
    this.pa = React.createRef();
    this.gui = React.createRef();
  }
  handleChange = (e) => {
    var name = e.target.id;
    var value = e.target.value.toLowerCase();
    if (name === "phone") {
      this.setState({
        [name]: "+1" + value
      });
    } /* else if (e.target.id === "parentEmail") {
      this.setState({
        parentEmail: e.target.value.toLowerCase()
      });
  }*/ /*else {
      this.setState({
        [e.target.id]: specialFormatting(e.target.value)
      });
    }*/
  };
  componentWillUnmount = () => {
    this.isMountCanceled = true;
  };

  // prettier-ignore
  /*const stringAuthObj = (meAuth) => {
      var {
        uid, displayName,photoURL, email, emailVerified,phoneNumber, isAnonymous,  tenantId,
        providerData, apiKey, appName, authDomain, stsTokenManager,  refreshToken,  accessToken,
        expirationTime, redirectEventId, lastLoginAt,  createdAt, multiFactor
      } = meAuth;
      return { _id: uid,  uid, displayName,photoURL, email, emailVerified,  phoneNumber,
        isAnonymous,  tenantId, providerData, apiKey, appName, authDomain, stsTokenManager,
        refreshToken, accessToken, expirationTime,  redirectEventId,  lastLoginAt, createdAt,
        multiFactor: JSON.stringify(multiFactor)
      };
    };*/
  //under 13 not for such a social hazard; -ism
  signInWithMicrosoft = () => {
    const provider = new OAuthProvider("microsoft.com");
    provider.setCustomParameters({ tenant: "organizations" });

    signInWithPopup(getAuth(), provider)
      .then((result) => {
        console.log("Microsoft Sign-In Success:", result.user);
        this.setState({ auth: result.user });
      })
      .catch((error) => {
        console.error("Microsoft Sign-In Error:", error);
        this.setState({ authError: error.message });
      });
  };

  switchAccount = () => {
    const provider = new OAuthProvider("microsoft.com");
    provider.setCustomParameters({ tenant: "organizations", prompt: "select_account" });
    signInWithPopup(getAuth(), provider)
      .then((result) => {
        console.log("Switched to:", result.user.email);
        this.setState({ auth: result.user });
      })
      .catch((error) => {
        console.error("Switch Account Error:", error);
      });
  };

  handleAttend = async (eventId, existingCode) => {
    const { user } = this.state;
    if (!eventId) {
      window.alert("No event ID found in QR code.");
      return;
    }
    if (!user) {
      window.alert("Please sign in first.");
      return;
    }

    const auth = getAuth();
    if (!auth.currentUser) {
      window.alert("Please sign in first.");
      return;
    }
    const idToken = await auth.currentUser.getIdToken();
    const headers = {
      "Content-Type": "application/json",
      Authorization: "Bearer " + idToken
    };

    try {
      let code = existingCode;

      if (!code) {
        // Step 1: Generate one-time code
        const codeRes = await fetch("/api/code", {
          method: "POST",
          headers,
          body: JSON.stringify({ eventId })
        }).then((r) => r.json());

        if (codeRes.message === "already attended.") {
          window.alert("Already attended" + (codeRes.title ? ": " + codeRes.title : ""));
          this.props.navigate("/");
          return;
        }
        if (!codeRes.code) {
          window.alert(codeRes.message || "Could not generate attendance code");
          return;
        }
        code = codeRes.code;
      }

      // Step 2: Attend with code
      const attendRes = await fetch("/api/attend", {
        method: "POST",
        headers,
        body: JSON.stringify({
          eventId,
          code,
          fullName: user.fullName || "",
          address: user.address || ""
        })
      }).then((r) => r.json());

      window.alert(attendRes.message + (attendRes.title ? ": " + attendRes.title : ""));
      this.props.navigate("/");
    } catch (err) {
      window.alert("Attendance failed: " + err.message);
    }
  };

  componentDidMount = () => {
    onAuthStateChanged(
      getAuth(),
      async (auth) => {
        this.setState(
          { auth, loading: !auth ? false : this.state.loading },
          () => {
            if (auth) {
              const studentId = auth.email?.split("@")[0] || "";
              const isBootstrapAdmin = auth.email === "wqu@monmouth.edu";

              // Direct listener for the user's own leader doc
              // (the orderBy query excludes docs missing eventsAttended)
              onSnapshot(doc(firestore, "leaders", studentId), (dc) => {
                if (dc.exists()) {
                  this.setState({ myLeaderDoc: { id: dc.id, ...dc.data() } });
                } else {
                  this.setState({ myLeaderDoc: null });
                }
              });

              onSnapshot(doc(firestore, "users", studentId), (dc) => {
                if (dc.exists()) {
                  const userData = dc.data();
                  // Auto-promote bootstrap admin if not already set
                  if (isBootstrapAdmin && !userData.admin) {
                    updateDoc(doc(firestore, "users", studentId), {
                      admin: true
                    });
                  }
                  this.setState(
                    {
                      user: { ...userData, id: dc.id },
                      loaded: true,
                      loading: false
                    },
                    () => {
                      onSnapshot(
                        doc(firestore, "userDatas", auth.uid),
                        (dc) => {
                          if (dc.exists()) {
                            const userDatas = dc.data();
                            this.setState({
                              user: {
                                ...this.state.user,
                                ...userDatas,
                                userDatas: true
                              },
                              userDatas
                            });
                          }
                        }
                      );
                    }
                  );
                } else {
                  // Create new profile using studentId as Document ID
                  const newUser = {
                    studentId: studentId,
                    createdAt: new Date(),
                    admin: isBootstrapAdmin
                  };
                  setDoc(doc(firestore, "users", studentId), newUser).then(
                    () => {
                      this.setState({
                        user: { ...newUser, id: studentId },
                        loaded: true,
                        loading: false
                      });
                    }
                  );
                }
              });
            }
          }
        );
      },
      standardCatch
    );
    onSnapshot(
      collection(firestore, "events"),
      (querySnapshot) => {
        this.setState({
          events: querySnapshot.docs.map((dc) => {
            return { id: dc.id, ...dc.data() };
          })
        });
      },
      (error) => {
        this.setState({ eventsError: error.message });
      }
    );

    onSnapshot(
      query(
        collection(firestore, "leaders"),
        orderBy("eventsAttended", "desc")
        //limit(5)
      ),
      (querySnapshot) => {
        this.setState({
          leaders: querySnapshot.docs.map((dc) => {
            return { id: dc.id, ...dc.data() };
          }),
          leadersFormatted: querySnapshot.docs.map((dc) => {
            const data = dc.data();
            return [
              dc.id, // The document ID is the studentId slug
              data.fullName,
              data.address,
              data.eventsAttended
            ];
          })
        });
      },
      (error) => {
        this.setState({ leadersError: error.message });
      }
    );
  };

  componentDidUpdate = (prevProps, prevState) => {
    if (this.props.location !== prevProps.location) {
      let bumpedFrom =
        this.props.location.state && this.props.location.state.bumpedFrom
          ? this.props.location.state.bumpedFrom
          : this.state.bumpedFrom;
      this.setState({ bumpedFrom });
    }
    // Auto-attend when user lands on /event/:eventId?attend={code}
    const match = this.props.pathname.match(/^\/event\/(.+)$/);
    const params = new URLSearchParams(this.props.location.search);
    const attendCode = params.get("attend");
    if (
      match &&
      attendCode &&
      this.state.user &&
      (!prevState.user || this.props.pathname !== prevProps.pathname)
    ) {
      this.handleAttend(match[1], attendCode);
    }
  };

  login = () => {
    this.signInWithMicrosoft();
  };

  render() {
    const { newUserPlease, authError } = this.state;
    const meAuth =
        window.meAuth &&
        window.meAuth.constructor === Object &&
        Object.keys(window.meAuth).length > 0
          ? window.meAuth
          : undefined,
      space = " ",
      logoutofapp = (yes) => {
        signOut(getAuth())
          .then(async () => {
            console.log("logged out");
            //await setPersistence(getAuth(), browserSessionPersistence);
            this.setState({
              user: undefined,
              auth: null,
              loading: false
            });
            this.ra.current.click();
          })
          .catch((err) => {
            console.log(err);
          });
      };
    const columnCount = Math.round(this.props.width / 120);
    //console.log(this.state.users);
    const emailInitial = (this.state.auth?.email || "?")[0].toUpperCase();
    // Use the direct leader doc listener (not dependent on orderBy query)
    const myLeader = this.state.myLeaderDoc;
    const eventsAttended = myLeader?.eventsAttended || 0;
    const rank = this.state.leaders.findIndex(
      (l) => l.id === this.state.user?.studentId
    );
    const rankDisplay = rank >= 0 ? rank + 1 : "—";
    return (
      <div className="admin-root">
        {this.props.pathname === "/account" ? (
          <div className="privacy-policy-page">
            <div className="privacy-header">
              <h1>Account Settings</h1>
              <button
                className="btn btn-primary"
                onClick={() => this.props.navigate("/")}
              >
                ← Back to App
              </button>
            </div>
            <div className="privacy-content">
              {!this.state.auth ? (
                <p>Please sign in to manage your account.</p>
              ) : (
                <>
                  <h2>Your Information</h2>
                  <p><strong>Email:</strong> {this.state.auth.email}</p>
                  <p><strong>Student ID:</strong> {this.state.user?.studentId || "Loading..."}</p>
                  <p><strong>Display Name:</strong> {myLeader?.username || "Not set"}</p>
                  <p><strong>Events Attended:</strong> {eventsAttended}</p>
                  <p><strong>Current Rank:</strong> {rankDisplay}</p>

                  <h2>Data Management</h2>

                  <div style={{ marginBottom: "20px" }}>
                    <h3>Export Your Data</h3>
                    <p>Download all your attendance records in CSV format.</p>
                    <CSVLink
                      className="btn btn-primary"
                      data={[
                        ["Action", "Details"],
                        ["Student ID", this.state.user?.studentId || ""],
                        ["Email", this.state.auth.email || ""],
                        ["Display Name", myLeader?.username || ""],
                        ["Events Attended", eventsAttended],
                        ["Current Rank", rankDisplay],
                        ["Account Created", this.state.user?.createdAt?.toDate?.()?.toLocaleDateString() || "Unknown"]
                      ]}
                      filename={`passport-data-${this.state.user?.studentId || "export"}.csv`}
                    >
                      Download My Data (CSV)
                    </CSVLink>
                  </div>

                  <div style={{ marginBottom: "20px" }}>
                    <h3>Remove From Leaderboard</h3>
                    <p>Hide your display name from the public leaderboard while keeping your account.</p>
                    <button
                      className="btn btn-primary"
                      onClick={() => {
                        const id = this.state.user?.studentId;
                        if (!id) return;
                        const ref = doc(firestore, "leaders", id);
                        if (myLeader) {
                          updateDoc(ref, { username: "" })
                            .then(() => window.alert("Display name removed from leaderboard"))
                            .catch((err) => window.alert("Failed: " + err.message));
                        } else {
                          window.alert("You're not on the leaderboard yet.");
                        }
                      }}
                    >
                      Remove Display Name
                    </button>
                  </div>

                  <div style={{
                    marginTop: "40px",
                    padding: "20px",
                    border: "2px solid var(--danger)",
                    borderRadius: "var(--radius-md)",
                    backgroundColor: "#fff5f5"
                  }}>
                    <h3 style={{ color: "var(--danger)" }}>Delete Account</h3>
                    <p>
                      Permanently delete your account and all associated data. This action cannot be undone.
                      You will be removed from the leaderboard and disqualified from any pending prizes.
                    </p>
                    <p><strong>To delete your account:</strong></p>
                    <ol>
                      <li>Contact Monmouth University IT Services or the Office of the Provost</li>
                      <li>Email: sayists@icloud.com or visit the Provost Office</li>
                      <li>Provide your student ID: <strong>{this.state.user?.studentId}</strong></li>
                      <li>Request account deletion</li>
                      <li>Your data will be permanently deleted within 30 days</li>
                    </ol>
                    <p style={{ fontSize: "0.9rem", marginTop: "15px", opacity: 0.8 }}>
                      <strong>Note:</strong> Account deletion is processed manually to ensure security.
                      Automated deletion will be available in a future update.
                    </p>
                  </div>

                  <h2 style={{ marginTop: "40px" }}>Privacy & Legal</h2>
                  <div style={{ display: "flex", gap: "15px", flexWrap: "wrap" }}>
                    <span
                      onClick={() => this.props.navigate("/privacy")}
                      style={{ color: "var(--primary)", cursor: "pointer", textDecoration: "underline" }}
                    >
                      Privacy Policy
                    </span>
                    <span
                      onClick={() => this.props.navigate("/terms")}
                      style={{ color: "var(--primary)", cursor: "pointer", textDecoration: "underline" }}
                    >
                      Terms of Service
                    </span>
                    <span
                      onClick={() => this.props.navigate("/rules")}
                      style={{ color: "var(--primary)", cursor: "pointer", textDecoration: "underline" }}
                    >
                      Official Rules
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>
        ) : this.props.pathname === "/terms" ? (
          <div className="privacy-policy-page">
            <div className="privacy-header">
              <h1>Terms of Service</h1>
              <button
                className="btn btn-primary"
                onClick={() => this.props.navigate("/")}
              >
                ← Back to App
              </button>
            </div>
            <div className="privacy-content">
              <p><strong>Last Updated:</strong> February 2026</p>

              <h2>Overview</h2>
              <p>
                By using the Monmouth University Passport application, you agree to these Terms of Service
                and all related policies governing the app and Student Scholarship Week attendance tracking.
              </p>

              <h2>Applicable Policies</h2>
              <p>Use of this app is governed by the following policies:</p>
              <ul>
                <li>
                  <strong
                    onClick={() => this.props.navigate("/privacy")}
                    style={{ cursor: "pointer", color: "var(--primary)", textDecoration: "underline" }}
                  >
                    Privacy Policy
                  </strong> - How we collect, use, and protect your data
                </li>
                <li>
                  <strong
                    onClick={() => this.props.navigate("/rules")}
                    style={{ cursor: "pointer", color: "var(--primary)", textDecoration: "underline" }}
                  >
                    Official Rules
                  </strong> - Contest rules for Student Scholarship Week prizes
                </li>
              </ul>

              <h2>Acceptable Use</h2>
              <p>You agree to:</p>
              <ul>
                <li>Use your own Monmouth University credentials only</li>
                <li>Check in only at events you physically attend</li>
                <li>Not share, transfer, or sell your account</li>
                <li>Not attempt to manipulate attendance records or rankings</li>
                <li>Not interfere with the app's security measures</li>
              </ul>

              <h2>Account Authentication</h2>
              <p>
                Access requires valid Monmouth University student credentials via Microsoft OAuth.
                The university may revoke access for policy violations or upon graduation/withdrawal.
              </p>

              <h2>Attendance Verification</h2>
              <p>
                Event attendance is recorded via QR code scanning with one-time verification codes.
                Fraudulent check-ins may result in disqualification from prizes and potential
                academic integrity proceedings.
              </p>

              <h2>No Warranty</h2>
              <p>
                The app is provided "as is" without warranties. We do not guarantee uninterrupted
                access, error-free operation, or that the app will meet your specific needs.
              </p>

              <h2>Limitation of Liability</h2>
              <p>
                Monmouth University is not liable for technical issues, lost data, or inability
                to record attendance due to app malfunction. Prize eligibility may be affected
                if technical issues prevent attendance verification.
              </p>

              <h2>Changes to Terms</h2>
              <p>
                We may update these terms at any time. Continued use after changes constitutes
                acceptance of modified terms.
              </p>

              <h2>Contact</h2>
              <p>
                Questions about these terms should be directed to Monmouth University
                Office of the Provost or IT Services.
              </p>
            </div>
          </div>
        ) : this.props.pathname === "/rules" ? (
          <div className="privacy-policy-page">
            <div className="privacy-header">
              <h1>Official Rules</h1>
              <button
                className="btn btn-primary"
                onClick={() => this.props.navigate("/")}
              >
                ← Back to App
              </button>
            </div>
            <div className="privacy-content">
              <p><strong>Last Updated:</strong> February 2026</p>
              <p><strong>Student Scholarship Week Attendance Recognition Program</strong></p>

              <h2>1. Sponsor</h2>
              <p>
                This attendance recognition program is sponsored by Monmouth University,
                400 Cedar Avenue, West Long Branch, NJ 07764, through the Office of the Provost.
              </p>
              <p>
                <strong>Important Disclosure:</strong> Apple Inc. and Google LLC are not sponsors
                of this program and are not involved in any way with the distribution of prizes.
              </p>

              <h2>2. Eligibility</h2>
              <p>Open to currently enrolled Monmouth University students only. Participants must:</p>
              <ul>
                <li>Have active Monmouth University student credentials</li>
                <li>Be enrolled during the Student Scholarship Week period</li>
                <li>Be at least 16 years old, or have parental consent if under 18</li>
                <li>Comply with university policies and academic integrity standards</li>
              </ul>
              <p>
                University employees, faculty, staff, and immediate family members are eligible
                to participate but may be ineligible for certain prize categories at the
                university's discretion.
              </p>

              <h2>3. Program Period</h2>
              <p>
                The program runs during the annual Student Scholarship Week (typically in April).
                Specific dates are announced each academic year. Only events attended during the
                designated week are eligible for recognition.
              </p>

              <h2>4. How to Participate</h2>
              <p>No purchase necessary. To participate:</p>
              <ul>
                <li>Download the Monmouth University Passport app</li>
                <li>Sign in with your Monmouth University credentials</li>
                <li>Attend Student Scholarship Week events</li>
                <li>Scan the QR code displayed at each event to record attendance</li>
                <li>Each successful scan generates a one-time verification code to prevent duplicate entries</li>
              </ul>

              <h2>5. Winner Determination</h2>
              <p>
                Winners are determined by total verified event attendance during Student Scholarship Week.
                The app maintains a real-time leaderboard showing participant rankings.
              </p>
              <p>
                The number of prize recipients is determined by the university each year based on
                participation levels and available resources. Typically, top attendees (highest
                attendance counts) receive recognition.
              </p>
              <p>
                In the event of tied attendance counts, the university may award prizes to all
                tied participants or use timestamp of final event attendance as a tiebreaker.
              </p>

              <h2>6. Prizes</h2>
              <p>
                Prizes typically consist of gift cards (e.g., Dunkin', campus bookstore, or similar vendors)
                with approximate retail value of $5-$25 per card. Specific prizes and quantities are
                determined annually and announced at the start of Student Scholarship Week.
              </p>
              <p><strong>Prize Fulfillment:</strong></p>
              <ul>
                <li>Gift cards are purchased prior to the start of Student Scholarship Week</li>
                <li>Winners are verified after the program period concludes (approximately 1 month review period)</li>
                <li>Prizes are mailed to winners' registered university addresses or distributed via campus mail</li>
                <li>Shipping delays may occur; typical delivery is 4-8 weeks after Student Scholarship Week ends</li>
                <li>No cash substitutions or prize transfers</li>
                <li>Prizes are awarded "as is" with no warranty</li>
              </ul>
              <p>
                Approximate total prize pool value varies by year. Odds of winning depend on total
                participants and individual attendance levels. Based on historical participation
                (estimated 100-500 active users per year), odds range from approximately 1:10 to 1:50.
              </p>

              <h2>7. Winner Notification</h2>
              <p>
                Winners will be notified via their Monmouth University email address within
                30 days of Student Scholarship Week conclusion. Winners must respond within
                14 days to claim prizes. Unclaimed prizes may be forfeited.
              </p>

              <h2>8. Verification and Anti-Fraud Measures</h2>
              <p>
                All attendance records are subject to verification. The app uses one-time verification
                codes to prevent fraudulent check-ins. The university reserves the right to:
              </p>
              <ul>
                <li>Audit attendance records for accuracy</li>
                <li>Disqualify participants who violate academic integrity policies</li>
                <li>Disqualify participants who attempt to manipulate the system</li>
                <li>Investigate suspicious attendance patterns</li>
                <li>Require additional verification for prize recipients</li>
              </ul>
              <p>
                Fraudulent check-ins or attempts to circumvent security measures may result in
                disqualification and potential academic integrity proceedings.
              </p>

              <h2>9. Taxes</h2>
              <p>
                Winners are responsible for any applicable federal, state, or local taxes.
                Prize values are generally below IRS reporting thresholds, but winners should
                consult tax professionals for individual circumstances.
              </p>

              <h2>10. Privacy</h2>
              <p>
                Participant information is collected and used according to our{" "}
                <strong
                  onClick={() => this.props.navigate("/privacy")}
                  style={{ cursor: "pointer", color: "var(--primary)", textDecoration: "underline" }}
                >
                  Privacy Policy
                </strong>. By participating, you consent to the collection and use of your data as described.
              </p>

              <h2>11. Publicity</h2>
              <p>
                Winners may be recognized publicly (e.g., in university communications, on
                leaderboards). By participating, you consent to such recognition without
                additional compensation.
              </p>

              <h2>12. General Conditions</h2>
              <ul>
                <li>The university reserves the right to modify or cancel the program at any time</li>
                <li>The university is not responsible for technical failures, lost attendance records, or app malfunctions</li>
                <li>Decisions regarding winner selection and eligibility are final</li>
                <li>Void where prohibited by law</li>
              </ul>

              <h2>13. Disputes</h2>
              <p>
                Any disputes arising from this program shall be governed by New Jersey law
                and resolved through the university's standard grievance procedures.
              </p>

              <h2>14. Questions</h2>
              <p>
                For questions about these rules, contact the Monmouth University Office of
                the Provost or visit the Student Scholarship Week information page.
              </p>
            </div>
          </div>
        ) : this.props.pathname === "/privacy" ? (
          <div className="privacy-policy-page">
            <div className="privacy-header">
              <h1>Privacy Policy</h1>
              <button
                className="btn btn-primary"
                onClick={() => this.props.navigate("/")}
              >
                ← Back to App
              </button>
            </div>
            <div className="privacy-content">
              <p><strong>Last Updated:</strong> February 2026</p>

              <h2>Introduction</h2>
              <p>
                Monmouth University Passport ("we," "our," or "us") operates this application
                to help students track event attendance during Scholarship Week and other campus events.
              </p>

              <h2>Age Requirements</h2>
              <p>
                <strong>This app is intended for users 16 years of age and older.</strong> Users
                under 18 must have parental or guardian consent to participate. Our services are
                not directed to children under the age of 13, and we do not knowingly collect
                personal information from children under 13. If you believe we have inadvertently
                collected such information, please contact us immediately at sayists@icloud.com.
              </p>

              <h2>Information We Collect</h2>
              <p>We collect the following categories of information:</p>

              <h3>1. Identifiers</h3>
              <ul>
                <li><strong>University Email Address:</strong> Used for authentication and account management</li>
                <li><strong>Student ID:</strong> Derived from your email, used to uniquely identify your account</li>
                <li><strong>Display Name:</strong> Optional user-provided name for leaderboard display</li>
                <li><strong>Mailing Address:</strong> Collected from prize winners for gift card fulfillment</li>
              </ul>
              <p style={{ fontSize: "0.9rem", marginTop: "10px", opacity: 0.85 }}>
                <strong>Note on Microsoft Authentication:</strong> When you sign in with Microsoft, Firebase Authentication
                may receive additional profile information from your Microsoft account (such as your name or profile photo).
                This data is processed solely for authentication purposes and is <strong>not stored in our database</strong>.
                We only store your email address and derived student ID.
              </p>

              <h3>2. App Activity</h3>
              <ul>
                <li><strong>Event Attendance Timestamps:</strong> Date and time of each event check-in</li>
                <li><strong>QR Code Scan Data:</strong> Verification codes generated when scanning event QR codes</li>
                <li><strong>Attendance Records:</strong> Total events attended and historical attendance data</li>
                <li><strong>Leaderboard Rankings:</strong> Your position relative to other participants</li>
              </ul>

              <h2>How We Use Your Information</h2>
              <p>We use the collected information for the following purposes:</p>
              <ul>
                <li><strong>Account Management:</strong> Authenticate users, manage profiles, and process account deletion requests (uses email and student ID)</li>
                <li><strong>Event Check-ins:</strong> Record attendance when you scan QR codes at events (uses student ID and attendance timestamps)</li>
                <li><strong>Prize Distribution:</strong> Determine winners and mail gift cards to recipients (uses name, student ID, email, mailing address)</li>
                <li><strong>Leaderboard Display:</strong> Show real-time rankings of top participants (uses optional display name or "Anonymous")</li>
                <li><strong>Fraud Prevention:</strong> Detect and prevent duplicate check-ins and system manipulation (uses student ID and attendance patterns)</li>
                <li><strong>Analytics:</strong> Generate anonymized, aggregated attendance metrics for event performance and planning (does not use personal identifiers)</li>
              </ul>
              <p style={{ fontSize: "0.9rem", marginTop: "10px", opacity: 0.85 }}>
                <strong>Data Usage Summary:</strong> Account management, fraud prevention, and prize distribution require personal
                identifiers (email, student ID, mailing address) to function properly. Analytics uses only app activity data
                (attendance records) and does not access personal identifiers. All analytics data is aggregated and anonymized
                (e.g., "50 students attended Event X") before being shared with the University for event planning.
              </p>

              <h2>Data Storage and Security</h2>
              <p>
                Your data is stored securely using Google Firebase services. We implement
                appropriate security measures to protect your information from unauthorized access.
              </p>

              <h2>Data Sharing</h2>
              <p>
                <strong>We do not sell, rent, or trade your personal information to third parties
                for marketing purposes.</strong> Your data is only shared in the following limited circumstances:
              </p>
              <ul>
                <li>
                  <strong>Monmouth University (Sponsor):</strong> We share your identifiers (name, student ID,
                  email, mailing address) and attendance records with the Office of the Provost for prize
                  verification and gift card fulfillment. The University also receives anonymized, aggregated
                  attendance data for event performance metrics and future planning.
                </li>
                <li>
                  <strong>Service Providers:</strong> We use Google Firebase for data storage and Microsoft
                  for authentication. These providers process data on our behalf and are contractually obligated
                  to protect your information.
                </li>
                <li>
                  <strong>Legal Requirements:</strong> We may disclose information if required by law, court order,
                  or government regulation.
                </li>
              </ul>
              <p>
                We do not share your data with advertisers, data brokers, or other third-party commercial entities.
              </p>

              <h2>Device Permissions</h2>
              <p>The app requests the following device permissions:</p>
              <ul>
                <li>
                  <strong>Camera:</strong> Required to scan QR codes at events for attendance verification.
                  The camera is only active when you use the scan feature and no images are stored.
                </li>
                <li>
                  <strong>Internet:</strong> Required to sync attendance data with our servers
                  and authenticate your account.
                </li>
              </ul>

              <h2>Data Retention</h2>
              <p>
                We retain your attendance data for the duration of your enrollment at Monmouth University
                plus one academic year for historical records and prize fulfillment. After this period,
                personally identifiable information is anonymized or deleted.
              </p>

              <h2>Your Rights</h2>
              <p>You have the right to:</p>
              <ul>
                <li><strong>Access:</strong> Request a copy of your personal data</li>
                <li><strong>Correction:</strong> Request correction of inaccurate data</li>
                <li><strong>Deletion:</strong> Request deletion of your account and data (see below)</li>
                <li><strong>Data Portability:</strong> Receive your attendance records in CSV format</li>
                <li><strong>Opt-Out:</strong> Remove your display name from the public leaderboard</li>
              </ul>
              <p>
                To exercise any of these rights, contact the Office of the Provost or IT Services
                with your student ID.
              </p>

              <h2>Account Deletion</h2>
              <p>
                You can request deletion of your account and all associated data at any time.
              </p>
              <p><strong>Via Web App:</strong></p>
              <ul>
                <li>
                  Visit{" "}
                  <span
                    onClick={() => this.props.navigate("/account")}
                    style={{ color: "var(--primary)", cursor: "pointer", textDecoration: "underline" }}
                  >
                    Account Settings
                  </span>{" "}
                  (or navigate to <code>https://pass.contact/account</code>)
                </li>
                <li>Follow the account deletion instructions</li>
              </ul>
              <p><strong>Via Mobile App:</strong></p>
              <ul>
                <li>Open the app menu and select "Account Settings"</li>
                <li>Follow the deletion instructions provided</li>
              </ul>
              <p><strong>Via Direct Contact:</strong></p>
              <ol>
                <li>Contact Monmouth University IT Services or the Office of the Provost</li>
                <li>Provide your student ID and request account deletion</li>
                <li>Your data will be permanently deleted within 30 days</li>
              </ol>
              <p>
                <strong>Note:</strong> Deleting your account will remove you from the leaderboard and disqualify
                you from any pending prize eligibility. Historical aggregate data (anonymized)
                may be retained for university records.
              </p>

              <h2>Minors and Parental Consent</h2>
              <p>
                <strong>Users aged 16-17:</strong> You may use this app with parental or guardian consent.
                We recommend that parents review this privacy policy and discuss data collection practices
                with their children before allowing participation.
              </p>
              <p>
                <strong>Children under 13:</strong> Our services are not directed to children under 13 years of age.
                We do not knowingly collect personal information from children under 13. If we discover that we have
                inadvertently collected information from a child under 13, we will promptly delete it. Parents who
                believe we have collected information from their child under 13 should contact us at sayists@icloud.com.
              </p>

              <h2>Contact Us</h2>
              <p>
                For questions about this privacy policy, to exercise your data rights, or to
                request account deletion, please contact:
              </p>
              <ul>
                <li>Monmouth University IT Services</li>
                <li>Email: sayists@icloud.com</li>
                <li>Office of the Provost</li>
              </ul>

              <h2>Changes to This Policy</h2>
              <p>
                We may update this privacy policy from time to time. Continued use of the
                app constitutes acceptance of any changes.
              </p>
            </div>
          </div>
        ) : this.props.pathname !== "/leaderboard" ? (
          this.state.auth && (
            <div className="dash-header">
              <div className="dash-header-left">
                <img
                  src="/ScholarWeek_Logo.png"
                  //src="/MU-logo.png"
                  alt="Logo"
                  className="dash-logo"
                />
                <span className="dash-header-brand">Passport</span>
              </div>
              <div className="dash-header-right">
                <div className="dash-avatar">{emailInitial}</div>
                <button
                  className="dash-logout-btn"
                  style={{ marginRight: "10px" }}
                  onClick={() => this.props.navigate("/account")}
                >
                  Account
                </button>
                <button
                  className="dash-logout-btn"
                  onClick={() => {
                    var answer = window.confirm("logout?");
                    answer && logoutofapp();
                  }}
                >
                  Sign Out
                </button>
              </div>
            </div>
          )
        ) : (
          <div className="leaderboard-tv-root">
            <h1 style={{ fontSize: "3.5rem", marginBottom: "10px" }}>
              Scholarship Week
            </h1>
            <p style={{ fontSize: "1.5rem", opacity: 0.8 }}>
              Live Leaderboard — Top students win prizes!
            </p>

            {this.state.leadersError ? (
              <div
                style={{
                  marginTop: "100px",
                  color: "var(--danger)",
                  fontSize: "1.5rem"
                }}
              >
                {this.state.leadersError}
              </div>
            ) : this.state.leaders.length === 0 ? (
              <div
                style={{ marginTop: "100px", fontSize: "2rem", opacity: 0.5 }}
              >
                Waiting for the first participants to scan...
              </div>
            ) : (
              <>
                <div className="podium-container">
                  {this.state.leaders.slice(0, 3).map((leader, i) => {
                    const ranks = ["rank-1", "rank-2", "rank-3"];
                    const medals = ["🥇", "🥈", "🥉"];
                    return (
                      <div
                        key={leader.id}
                        className={`podium-item ${ranks[i]}`}
                      >
                        <div className="medal">{medals[i]}</div>
                        <div className="podium-name">
                          {leader.username || "Anonymous"}
                        </div>
                        <div className="podium-score">
                          {leader.eventsAttended}
                        </div>
                        <div style={{ fontSize: "0.9rem", opacity: 0.7 }}>
                          Events
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="other-leaders-list">
                  {this.state.leaders.slice(3, 21).map((leader, i) => (
                    <div key={leader.id} className="leader-row">
                      <span>
                        <strong style={{ marginRight: "15px", opacity: 0.5 }}>
                          {i + 4}
                        </strong>{" "}
                        {leader.username || "Anonymous"}
                      </span>
                      <span style={{ fontWeight: "bold" }}>
                        {leader.eventsAttended} pts
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}

            <div
              onClick={() => this.props.navigate("/")}
              style={{ marginTop: "40px", opacity: 0.3, cursor: "pointer" }}
            >
              Admin Login
            </div>
          </div>
        )}

        <div
          style={{
            display: this.props.pathname !== "/leaderboard" ? "flex" : "none"
          }}
        >
          <div>{authError && authError.toString()}</div>

          {!this.state.auth && !this.state.loading && (
            <div className="login-screen">
              <div className="login-card-hero">
                <img
                  src="/ScholarWeek_Logo.png"
                  alt="Monmouth Logo"
                  style={{ width: "100%", marginBottom: "20px" }}
                />
                <h2 style={{ marginBottom: "10px", color: "#323130" }}>
                  Passport Portal
                </h2>
                <p style={{ marginBottom: "30px", color: "#605e5c" }}>
                  Sign in to manage Scholarship Week events and prizes.
                </p>

                <button className="microsoft-btn" onClick={() => this.login()}>
                  <img
                    src="https://authjs.dev/img/providers/microsoft.svg"
                    width="20"
                    alt=""
                  />
                  Sign in with Microsoft
                </button>

                <button
                  className="microsoft-btn"
                  style={{ marginTop: "10px", background: "#605e5c" }}
                  onClick={() => this.switchAccount()}
                >
                  <img
                    src="https://authjs.dev/img/providers/microsoft.svg"
                    width="20"
                    alt=""
                  />
                  Use a different account
                </button>

                <div className="app-links">
                  <a
                    href="#"
                    className="btn btn-primary"
                    style={{ fontSize: "12px", textDecoration: "none" }}
                  >
                    App Store
                  </a>
                  <a
                    href="#"
                    className="btn btn-primary"
                    style={{ fontSize: "12px", textDecoration: "none" }}
                  >
                    Play Store
                  </a>
                </div>

                <div
                  style={{
                    marginTop: "20px",
                    fontSize: "0.75rem",
                    display: "flex",
                    gap: "15px",
                    justifyContent: "center",
                    flexWrap: "wrap"
                  }}
                >
                  <span
                    onClick={() => this.props.navigate("/terms")}
                    style={{ color: "#605e5c", cursor: "pointer", textDecoration: "underline" }}
                  >
                    Terms
                  </span>
                  <span
                    onClick={() => this.props.navigate("/rules")}
                    style={{ color: "#605e5c", cursor: "pointer", textDecoration: "underline" }}
                  >
                    Rules
                  </span>
                  <span
                    onClick={() => this.props.navigate("/privacy")}
                    style={{ color: "#605e5c", cursor: "pointer", textDecoration: "underline" }}
                  >
                    Privacy
                  </span>
                </div>

                <div
                  onClick={() =>
                    this.setState({
                      auth: { email: "preview@monmouth.edu" },
                      loading: false
                    })
                  }
                  style={{
                    marginTop: "20px",
                    color: "#0078d4",
                    cursor: "pointer",
                    fontSize: "0.8rem"
                  }}
                >
                  Preview Mode (TDD)
                </div>
              </div>
            </div>
          )}

          <div
            style={{
              display: this.state.auth ? "block" : "none"
            }}
          >
            <div className="dash-container">
              {/* Hero Stats Banner */}
              <div className="dash-hero">
                <div className="dash-hero-stats">
                  <div className="dash-stat">
                    <div className="dash-stat-value">{eventsAttended}</div>
                    <div className="dash-stat-label">Events</div>
                  </div>
                  <div className="dash-stat">
                    <div className="dash-stat-value">{rankDisplay}</div>
                    <div className="dash-stat-label">Rank</div>
                  </div>
                </div>
                <div className="dash-hero-name">
                  <strong>{this.state.user?.studentId}</strong>
                  <input
                    className="dash-username-input"
                    value={
                      this.state.profileUsername ?? (myLeader?.username || "")
                    }
                    onChange={(e) =>
                      this.setState({ profileUsername: e.target.value })
                    }
                    placeholder="Display name"
                  />
                  <button
                    className="dash-username-save"
                    onClick={() => {
                      const id = this.state.user?.studentId;
                      if (!id) return;
                      const val =
                        this.state.profileUsername ??
                        (myLeader?.username || "");
                      const ref = doc(firestore, "leaders", id);
                      const save = myLeader
                        ? updateDoc(ref, { username: val })
                        : setDoc(ref, { username: val, eventsAttended: 0 });
                      save
                        .then(() => window.alert("Username saved"))
                        .catch((err) => window.alert("Save failed: " + err.message));
                    }}
                  >
                    &#10003;
                  </button>
                </div>
              </div>

              {/* Check-In Toast */}
              {this.props.pathname.match(/^\/event\/(.+)$/) &&
                new URLSearchParams(this.props.location.search).get("attend") && (
                  <div className="dash-checkin-toast">
                    {this.state.user
                      ? "Processing attendance..."
                      : "Please sign in to check in."}
                  </div>
                )}

              {/* Event Itinerary */}
              <div className="card">
                <h3>Events</h3>
                {this.state.events.length === 0 ? (
                  <p style={{ opacity: 0.5 }}>No events yet.</p>
                ) : (
                  <div className="itinerary-list">
                    {this.state.events
                      .sort((a, b) => new Date(a.date) - new Date(b.date))
                      .map((x) => (
                        <div key={x.id} className="itinerary-item">
                          <div className="itinerary-date">
                            {x.date
                              ? new Date(x.date).toLocaleDateString(undefined, {
                                  weekday: "short",
                                  month: "short",
                                  day: "numeric"
                                })
                              : "TBD"}
                            {x.date && (
                              <span className="itinerary-time">
                                {new Date(x.date).toLocaleTimeString(undefined, {
                                  hour: "numeric",
                                  minute: "2-digit"
                                })}
                              </span>
                            )}
                          </div>
                          <div className="itinerary-details">
                            <strong>{x.title}</strong>
                            <span className="itinerary-meta">
                              {[x.location, x.department].filter(Boolean).join(" · ")}
                            </span>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>

              {/* Admin Tabs Section */}
              {this.state.user?.admin && (
                <div className="dash-admin-section">
                  <div className="dash-admin-tabs">
                    {["users", "new", "events"].map((tab) => (
                      <button
                        key={tab}
                        className={
                          "dash-tab" +
                          (this.state.activeAdminTab === tab ? " active" : "")
                        }
                        onClick={() => this.setState({ activeAdminTab: tab })}
                      >
                        {tab === "users"
                          ? "Users"
                          : tab === "new"
                            ? "New Event"
                            : "Events"}
                      </button>
                    ))}
                  </div>

                  {this.state.activeAdminTab === "users" && (
                    <div className="dash-admin-panel">
                      <div className="card">
                        <h3>User Management</h3>
                        <form
                          onSubmit={(e) => e.preventDefault()}
                          style={{
                            display: "flex",
                            gap: "10px",
                            marginBottom: "15px"
                          }}
                        >
                          <input
                            onChange={(e) => {
                              const val = e.target.value.toLowerCase();
                              this.setState({ searchId: val });
                              clearTimeout(this.searchTimeout);
                              this.searchTimeout = setTimeout(() => {
                                onSnapshot(
                                  query(
                                    collection(firestore, "users"),
                                    where("studentId", "==", val)
                                  ),
                                  (querySnapshot) => {
                                    this.setState({
                                      users: querySnapshot.docs.map(
                                        (document) => ({
                                          id: document.id,
                                          ...document.data()
                                        })
                                      )
                                    });
                                  }
                                );
                              }, 1500);
                            }}
                            placeholder="Enter Student ID to Authorize"
                          />
                        </form>
                        {this.state.searchId && (
                          <div
                            style={{
                              display: "flex",
                              gap: "10px",
                              marginTop: "10px"
                            }}
                          >
                            <button
                              className="btn btn-primary"
                              onClick={() => {
                                const id = this.state.searchId;
                                setDoc(
                                  doc(firestore, "users", id),
                                  {
                                    admin: true,
                                    studentId: id,
                                    createdAt: new Date()
                                  },
                                  { merge: true }
                                ).then(() =>
                                  window.alert(id + " dubbed Admin.")
                                );
                              }}
                            >
                              Dub Admin
                            </button>
                            <button
                              className="btn btn-danger"
                              onClick={() => {
                                const id = this.state.searchId;
                                updateDoc(doc(firestore, "users", id), {
                                  admin: false
                                }).then(() =>
                                  window.alert(id + " removed from Admins.")
                                );
                              }}
                            >
                              Revoke
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {this.state.activeAdminTab === "new" && (
                    <div className="dash-admin-panel">
                      <div className="card">
                        <h3>Create New Event</h3>
                        <form
                          className="form-grid"
                          onSubmit={(e) => {
                            e.preventDefault();
                            this.state.user.admin &&
                              addDoc(collection(firestore, "events"), {
                                title: this.state.newTitle,
                                date: this.state.newDate,
                                descriptionLink: this.state.newDescriptionLink,
                                location: this.state.newLocation,
                                department: this.state.newDepartment,
                                school: this.state.newSchool,
                                attendees: []
                              }).then(() => {
                                this.setState({
                                  newTitle: "",
                                  newDate: "",
                                  newDescriptionLink: "",
                                  newLocation: "",
                                  newDepartment: "",
                                  newSchool: ""
                                });
                              });
                          }}
                        >
                          <input
                            value={this.state.newTitle}
                            onChange={(e) =>
                              this.setState({ newTitle: e.target.value })
                            }
                            required={true}
                            placeholder="title"
                          />
                          <input
                            value={this.state.newDate}
                            onChange={(e) =>
                              this.setState({ newDate: e.target.value })
                            }
                            required={true}
                            placeholder="date"
                            type="datetime-local"
                          />
                          <input
                            value={this.state.newDescriptionLink}
                            onChange={(e) =>
                              this.setState({
                                newDescriptionLink: e.target.value
                              })
                            }
                            required={true}
                            placeholder="description link"
                          />
                          <input
                            value={this.state.newLocation}
                            onChange={(e) =>
                              this.setState({ newLocation: e.target.value })
                            }
                            required={true}
                            placeholder="location"
                          />
                          <input
                            value={this.state.newDepartment}
                            onChange={(e) =>
                              this.setState({
                                newDepartment: e.target.value
                              })
                            }
                            required={true}
                            placeholder="department"
                          />
                          <input
                            value={this.state.newSchool}
                            onChange={(e) =>
                              this.setState({ newSchool: e.target.value })
                            }
                            required={true}
                            placeholder="school"
                          />
                          <button className="btn btn-primary" type="submit">
                            Create Event
                          </button>
                        </form>
                      </div>
                    </div>
                  )}

                  {this.state.activeAdminTab === "events" && (
                    <div className="dash-admin-panel">
                      <div className="card">
                        <h3>Manage Events</h3>
                        <table className="admin-table">
                          <thead>
                            <tr>
                              <th>Del</th>
                              <th>Title</th>
                              <th>Location</th>
                              <th>Dept</th>
                              <th>School</th>
                              <th>QR</th>
                            </tr>
                          </thead>
                          <tbody>
                            {this.state.eventsError ? (
                              <tr>
                                <td
                                  colSpan="6"
                                  style={{
                                    textAlign: "center",
                                    padding: "40px",
                                    color: "var(--danger)"
                                  }}
                                >
                                  {this.state.eventsError}
                                </td>
                              </tr>
                            ) : this.state.events.length === 0 ? (
                              <tr>
                                <td
                                  colSpan="6"
                                  style={{
                                    textAlign: "center",
                                    padding: "40px",
                                    opacity: 0.5
                                  }}
                                >
                                  No events created yet.
                                </td>
                              </tr>
                            ) : (
                              this.state.events
                                .sort(
                                  (a, b) => new Date(a.date) - new Date(b.date)
                                )
                                .map((x) => (
                                  <tr key={x.id}>
                                    <td
                                      className="btn-danger"
                                      style={{
                                        cursor: "pointer",
                                        textAlign: "center"
                                      }}
                                      onClick={() => {
                                        var answer = window.confirm("delete?");
                                        answer &&
                                          deleteDoc(
                                            doc(firestore, "events", x.id)
                                          );
                                      }}
                                    >
                                      &times;
                                    </td>
                                    <td>{x.title}</td>
                                    <td>{x.location}</td>
                                    <td>{x.department}</td>
                                    <td>{x.school}</td>
                                    <td>
                                      <form
                                        onSubmit={(e) => {
                                          e.preventDefault();
                                          Font.register({
                                            family: "Roboto",
                                            src: "https://cdnjs.cloudflare.com/ajax/libs/ink/3.1.10/fonts/Roboto/roboto-light-webfont.ttf"
                                          });
                                          const styles = StyleSheet.create({
                                            page: {
                                              margin: 30,
                                              width: "100%",
                                              height: "100%"
                                            },
                                            section: {
                                              color: "white",
                                              textAlign: "center",
                                              fontFamily: "Roboto"
                                            }
                                          });
                                          const pdfRoot = createRoot(
                                            document.getElementById("root")
                                          );
                                          pdfRoot.render(
                                            <PDFViewer>
                                              <Document>
                                                <Page
                                                  size="A4"
                                                  style={styles.page}
                                                >
                                                  <Text>
                                                    {x.title}:{" "}
                                                    {x.descriptionLink}
                                                  </Text>
                                                  <View
                                                    style={styles.section}
                                                  >
                                                    <Image
                                                      style={{
                                                        width: "300px"
                                                      }}
                                                      src={QRCode.toDataURL(
                                                        window.location
                                                          .origin +
                                                          "/event/" +
                                                          x.id
                                                      )}
                                                    />
                                                  </View>
                                                </Page>
                                              </Document>
                                            </PDFViewer>,
                                            document.getElementById("root")
                                          );
                                        }}
                                      >
                                        <button
                                          className="btn btn-primary"
                                          style={{ fontSize: "10px" }}
                                          type="submit"
                                        >
                                          PDF
                                        </button>
                                      </form>
                                    </td>
                                  </tr>
                                ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Footer */}
              <div className="dash-footer">
                <div className="dash-footer-links">
                  <div onClick={() => this.props.navigate("/leaderboard")}>
                    Leaderboard
                  </div>
                  <CSVLink
                    className="dash-footer-link"
                    data={[
                      ["studentId", "name", "address", "eventsAttended"],
                      ...this.state.leadersFormatted
                    ]}
                  >
                    Export CSV
                  </CSVLink>
                  <div onClick={() => this.props.navigate("/terms")}>
                    Terms
                  </div>
                  <div onClick={() => this.props.navigate("/rules")}>
                    Rules
                  </div>
                  <div onClick={() => this.props.navigate("/privacy")}>
                    Privacy
                  </div>
                  <a href="#">App Store</a>
                  <a href="#">Play Store</a>
                </div>
              </div>
            </div>
          </div>

          {/* Scanner Modal Overlay */}
          {this.state.scanning && (
            <div className="dash-scanner-overlay">
              <div className="dash-scanner-modal">
                <div className="dash-scanner-header">
                  <span>Scan QR Code</span>
                  <button
                    className="dash-scanner-close"
                    onClick={() => {
                      if (this._stream) {
                        this._stream.getTracks().forEach((t) => t.stop());
                        this._stream = null;
                      }
                      this.setState({ scanning: false });
                      this._scanStarted = false;
                    }}
                  >
                    &times;
                  </button>
                </div>
                <div className="dash-scanner-viewfinder">
                  <video
                    ref={(el) => {
                      if (el && !el.srcObject && !this._scanStarted) {
                        this._scanStarted = true;
                        navigator.mediaDevices
                          .getUserMedia({
                            video: { facingMode: "environment" }
                          })
                          .then((stream) => {
                            this._stream = stream;
                            el.srcObject = stream;
                            el.play();

                            const onDetected = (url) => {
                              const match = url.match(/\/event\/([^?]+)/);
                              if (match) {
                                stream.getTracks().forEach((t) => t.stop());
                                this._stream = null;
                                this.setState({ scanning: false });
                                this._scanStarted = false;
                                this.handleAttend(match[1]);
                              }
                            };

                            if ("BarcodeDetector" in window) {
                              const detector = new BarcodeDetector({
                                formats: ["qr_code"]
                              });
                              const scan = () => {
                                if (!this.state.scanning) {
                                  stream
                                    .getTracks()
                                    .forEach((t) => t.stop());
                                  return;
                                }
                                detector
                                  .detect(el)
                                  .then((codes) => {
                                    if (codes.length > 0)
                                      onDetected(codes[0].rawValue);
                                    if (this.state.scanning)
                                      requestAnimationFrame(scan);
                                  })
                                  .catch(() => {
                                    if (this.state.scanning)
                                      requestAnimationFrame(scan);
                                  });
                              };
                              requestAnimationFrame(scan);
                            } else {
                              // jsQR fallback for browsers without BarcodeDetector
                              const canvas = document.createElement("canvas");
                              const ctx = canvas.getContext("2d");
                              const scan = () => {
                                if (!this.state.scanning) {
                                  stream
                                    .getTracks()
                                    .forEach((t) => t.stop());
                                  return;
                                }
                                if (el.videoWidth && el.videoHeight) {
                                  canvas.width = el.videoWidth;
                                  canvas.height = el.videoHeight;
                                  ctx.drawImage(el, 0, 0);
                                  const imageData = ctx.getImageData(
                                    0,
                                    0,
                                    canvas.width,
                                    canvas.height
                                  );
                                  const code = jsQR(
                                    imageData.data,
                                    imageData.width,
                                    imageData.height
                                  );
                                  if (code) onDetected(code.data);
                                }
                                if (this.state.scanning)
                                  requestAnimationFrame(scan);
                              };
                              requestAnimationFrame(scan);
                            }
                          })
                          .catch((err) => {
                            window.alert(
                              "Camera access denied: " + err.message
                            );
                            this.setState({ scanning: false });
                            this._scanStarted = false;
                          });
                      }
                    }}
                    playsInline
                    muted
                  />
                  <div className="dash-scanner-crosshair" />
                  <div className="dash-scanner-line" />
                </div>
                <p className="dash-scanner-hint">
                  Point at a Passport event QR code
                </p>
              </div>
            </div>
          )}

          {/* Scan FAB */}
          {this.state.auth &&
            !this.state.scanning &&
            this.props.pathname !== "/leaderboard" && (
              <button
                className="dash-scan-fab"
                onClick={() => this.setState({ scanning: true })}
              >
                Scan QR
              </button>
            )}
        </div>
      </div>
    );
  }
}
