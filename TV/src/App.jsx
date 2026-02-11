import React from "react";
import { createRoot } from "react-dom/client";
import { CSVLink } from "react-csv";
import QRCode from "qrcode";
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

  handleAttend = (eventId) => {
    const { user } = this.state;
    if (!eventId || !user) return;

    fetch("/api/attend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventId,
        studentId: user.studentId,
        fullName: user.fullName || "",
        address: user.address || ""
      })
    })
      .then((res) => res.json())
      .then((data) => {
        window.alert(data.message + (data.title ? ": " + data.title : ""));
        this.props.navigate("/");
      })
      .catch((err) => standardCatch(err, "Attendance Error"));
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
    // Auto-attend when user lands on /event/:eventId?attend=true
    const match = this.props.pathname.match(/^\/event\/(.+)$/);
    const params = new URLSearchParams(this.props.location.search);
    if (
      match &&
      params.get("attend") === "true" &&
      this.state.user &&
      (!prevState.user || this.props.pathname !== prevProps.pathname)
    ) {
      this.handleAttend(match[1]);
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
    const myLeader = this.state.leaders.find(
      (l) => l.id === this.state.user?.studentId
    );
    const eventsAttended = myLeader?.eventsAttended || 0;
    const rank = myLeader
      ? this.state.leaders.findIndex(
          (l) => l.id === this.state.user?.studentId
        ) + 1
      : "—";
    return (
      <div className="admin-root">
        {this.props.pathname !== "/leaderboard" ? (
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
                  onClick={() => this.switchAccount()}
                >
                  Switch
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
                          {leader.username || leader.id}
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
                        {leader.username || leader.id}
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
                  onClick={() =>
                    this.setState({
                      auth: { email: "preview@monmouth.edu" },
                      loading: false
                    })
                  }
                  style={{
                    marginTop: "30px",
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
                    <div className="dash-stat-value">{rank}</div>
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
                      setDoc(
                        doc(firestore, "leaders", id),
                        { username: val },
                        { merge: true }
                      ).then(() => window.alert("Username saved"));
                    }}
                  >
                    &#10003;
                  </button>
                </div>
              </div>

              {/* Check-In Toast */}
              {this.props.pathname.match(/^\/event\/(.+)$/) &&
                new URLSearchParams(this.props.location.search).get(
                  "attend"
                ) === "true" && (
                  <div className="dash-checkin-toast">
                    {this.state.user
                      ? "Processing attendance..."
                      : "Please sign in to check in."}
                  </div>
                )}

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
                                    <td
                                      onClick={() => {
                                        window.alert(x.date);
                                        this.setState({
                                          selectedEvent:
                                            this.state.selectedEvent === x.id
                                              ? null
                                              : x.id
                                        });
                                      }}
                                    >
                                      {x.title}
                                    </td>
                                    <td>{x.location}</td>
                                    <td>{x.department}</td>
                                    <td>{x.school}</td>
                                    <td>{x.descriptionLink}</td>
                                    {this.state.selectedEvent === x.id &&
                                      this.state.user.admin && (
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
                                                              x.id +
                                                              "?attend=true"
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
                                      )}
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
                            const detector = new BarcodeDetector({
                              formats: ["qr_code"]
                            });
                            const scan = () => {
                              if (!this.state.scanning) {
                                stream.getTracks().forEach((t) => t.stop());
                                return;
                              }
                              detector
                                .detect(el)
                                .then((codes) => {
                                  if (codes.length > 0) {
                                    const url = codes[0].rawValue;
                                    const match = url.match(/\/event\/([^?]+)/);
                                    if (match) {
                                      stream
                                        .getTracks()
                                        .forEach((t) => t.stop());
                                      this._stream = null;
                                      this.setState({ scanning: false });
                                      this._scanStarted = false;
                                      this.handleAttend(match[1]);
                                    }
                                  }
                                  if (this.state.scanning)
                                    requestAnimationFrame(scan);
                                })
                                .catch(() => {
                                  if (this.state.scanning)
                                    requestAnimationFrame(scan);
                                });
                            };
                            requestAnimationFrame(scan);
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
                onClick={() => {
                  if (!("BarcodeDetector" in window)) {
                    window.alert(
                      "Your browser doesn't support QR scanning. Use your phone camera to scan the QR code instead."
                    );
                    return;
                  }
                  this.setState({ scanning: true });
                }}
              >
                Scan QR
              </button>
            )}
        </div>
      </div>
    );
  }
}
