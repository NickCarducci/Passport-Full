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
  getDocs,
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
  username: "",
  //name: "",
  id: "",
  under13: false,
  textedCode: "",
  alertExistingUser: false,
  recaptchaResponse: "",
  attendingEventId: "",
  userQR: "",
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
      storedAuth
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
    } else if (name === "username") {
      this.setState({
        [name]:
          !value.includes(" ") &&
          !value.includes("_") &&
          value.match(/[a-z0-9]/g)
            ? value
            : ""
      });
      if (e.which !== 32) {
        this.setState({ findingSimilarNames: true });
        clearTimeout(this.typingUsername);
        this.typingUsername = setTimeout(() => {
          this.setState({ findingSimilarNames: false }, () => {
            const individualTypes = [],
              newIndTypes = individualTypes.map((x) => x.replace(/[ ,-]/g, "")),
              pagesNamesTaken = [
                "event",
                "events",
                "club",
                "clubs",
                "shop",
                "shops",
                "restaurant",
                "restaurants",
                "service",
                "services",
                "dept",
                "department",
                "departments",
                "classes",
                "class",
                "oldclass",
                "oldclasses",
                "job",
                "jobs",
                "housing",
                "oldhome",
                "page",
                "pages",
                "venue",
                "venues",
                "forum",
                "posts",
                "post",
                "oldelection",
                "elections",
                "election",
                "case",
                "cases",
                "oldcase",
                "oldcases",
                "budget",
                "budgets",
                "oldbudget",
                "oldbudgets",
                "ordinance",
                "ordinances",
                "new",
                "news",
                "login",
                "logins",
                "doc",
                "docs",
                "private",
                "privacy",
                "legal",
                "terms",
                "law",
                "laws",
                "bill",
                "bills"
              ],
              pagesNamesTaken1 = [...[], ...[]],
              curses = ["bitch", "cunt", "pussy", "pussies", "fuck", "shit"],
              hasCurse = curses.find((x) => value.toLowerCase().includes(x));

            if (
              hasCurse ||
              pagesNamesTaken.includes(value.toLowerCase()) ||
              pagesNamesTaken1.includes(value.toLowerCase())
            )
              return this.setState({ newUserPlease: true }, () =>
                window.alert(
                  "reserve word '" + value + "', please choose another"
                )
              );
            this.setState({ newUserPlease: false }, () =>
              getDocs(
                query(
                  collection(firestore, "users"),
                  where("username", "==", this.state.username)
                )
              ).then((snapshot) =>
                snapshot.docs.forEach((doc) =>
                  this.setState({ newUserPlease: doc.exists() })
                )
              )
            );
          });
        }, 1000);
      }
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
    clearTimeout(this.typingUsername);
    this.isMountCanceled = true;
  };

  componentDidUpdate = (prevProps) => {
    if (this.props.location !== prevProps.location) {
      let bumpedFrom =
        this.props.location.state && this.props.location.state.bumpedFrom
          ? this.props.location.state.bumpedFrom
          : this.state.bumpedFrom;
      this.setState({ bumpedFrom });
    }
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

  handleAttend = (e) => {
    e.preventDefault();
    const { attendingEventId, user } = this.state;
    if (!attendingEventId || !user) return;

    fetch("/api/attend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventId: attendingEventId,
        studentId: user.studentId,
        fullName: user.fullName || "",
        username: user.username || user.studentId,
        address: user.address || ""
      })
    })
      .then((res) => res.json())
      .then((data) => {
        window.alert(data.message + (data.title ? ": " + data.title : ""));
        this.setState({ attendingEventId: "" });
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
                    username: studentId,
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
    if (this.state.user?.studentId !== prevState.user?.studentId) {
      if (this.state.user?.studentId) {
        QRCode.toDataURL(this.state.user.studentId, (err, url) => {
          if (!err) this.setState({ userQR: url });
        });
      } else {
        this.setState({ userQR: "" });
      }
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
    return (
      <div className="admin-root">
        {this.props.pathname !== "/leaderboard" ? (
          <div className="header">
            <div className="header-side" style={{ width: "auto", gap: "15px" }}>
              <CSVLink
                className="btn btn-primary"
                style={{
                  textDecoration: "none",
                  fontSize: "12px",
                  padding: "5px 10px"
                }}
                data={[
                  ["studentId", "name", "address", "eventsAttended"],
                  ...this.state.leadersFormatted
                ]}
              >
                CSV
              </CSVLink>
              <div
                onClick={() => this.props.navigate("/leaderboard")}
                style={{ cursor: "pointer", fontSize: "12px" }}
              >
                Leaderboard
              </div>
            </div>
            <div className="header-title">Passport Admin Portal</div>
            <div
              className="header-side"
              style={{ justifyContent: "flex-end", width: "auto" }}
            >
              {this.state.auth && (
                <button
                  className="btn btn-danger"
                  onClick={() => {
                    var answer = window.confirm("logout?");
                    answer && logoutofapp();
                  }}
                  style={{
                    fontSize: "12px",
                    color: "white",
                    padding: "5px 10px"
                  }}
                >
                  Logout
                </button>
              )}
            </div>
          </div>
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
                        <div className="podium-name">{leader.username}</div>
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
                        {leader.username}
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
            <div className="admin-container">
              {/* My Profile Section - Visible to everyone */}
              <div className="card">
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start"
                  }}
                >
                  <div>
                    <h3>My Profile</h3>
                    <div style={{ marginBottom: "5px", fontSize: "14px" }}>
                      <strong>Student ID:</strong> {this.state.user?.studentId}
                    </div>
                    <div
                      style={{
                        marginBottom: "15px",
                        fontSize: "14px",
                        color: "var(--primary)",
                        fontWeight: "bold"
                      }}
                    >
                      Events Attended:{" "}
                      {this.state.leaders.find(
                        (l) => l.id === this.state.user?.studentId
                      )?.eventsAttended || 0}
                    </div>
                  </div>
                  {this.state.userQR && (
                    <img
                      src={this.state.userQR}
                      alt="My QR"
                      style={{
                        width: "80px",
                        border: "1px solid var(--border)"
                      }}
                    />
                  )}
                </div>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    updateDoc(
                      doc(firestore, "users", this.state.user.studentId),
                      {
                        username: this.state.username
                      }
                    ).then(() => window.alert("Username updated!"));
                  }}
                  style={{ display: "flex", gap: "10px" }}
                >
                  <input
                    id="username"
                    value={this.state.username}
                    onChange={this.handleChange}
                    placeholder="Set Display Username"
                  />
                  <button className="btn btn-primary" type="submit">
                    Update
                  </button>
                </form>
                {!this.state.user?.admin && (
                  <p
                    style={{
                      marginTop: "10px",
                      fontSize: "12px",
                      color: "grey"
                    }}
                  >
                    Set a username so an admin can identify and authorize your
                    account.
                  </p>
                )}
              </div>

              {/* Attend Event Section - Visible to everyone */}
              <div className="card">
                <h3>Attend Event</h3>
                <p
                  style={{
                    marginBottom: "15px",
                    fontSize: "12px",
                    color: "grey"
                  }}
                >
                  Enter the Event ID provided at the venue to check in.
                </p>
                <form
                  onSubmit={this.handleAttend}
                  style={{ display: "flex", gap: "10px" }}
                >
                  <input
                    id="attendingEventId"
                    value={this.state.attendingEventId}
                    onChange={(e) =>
                      this.setState({ attendingEventId: e.target.value })
                    }
                    placeholder="Enter Event ID"
                  />
                  <button className="btn btn-primary" type="submit">
                    Check In
                  </button>
                </form>
              </div>

              <div className="card">
                <h3>User Management</h3>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                  }}
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
                              users: querySnapshot.docs.map((document) => {
                                return { id: document.id, ...document.data() };
                              })
                            });
                          }
                        );
                      }, 1500);
                    }}
                    placeholder="Enter Student ID to Authorize"
                    style={{
                      height: "20px",
                      border: "0px"
                    }}
                  />
                </form>
                {this.state.searchId && (
                  <div
                    style={{ display: "flex", gap: "10px", marginTop: "10px" }}
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
                            username: id,
                            createdAt: new Date()
                          },
                          { merge: true }
                        ).then(() => window.alert(id + " dubbed Admin."));
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

              {this.state.user?.admin && (
                <>
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
                        onChange={(e) => {
                          this.setState({ newTitle: e.target.value });
                        }}
                        required={true}
                        placeholder="title"
                      />
                      <input
                        value={this.state.newDate}
                        onChange={(e) => {
                          this.setState({ newDate: e.target.value });
                        }}
                        required={true}
                        placeholder="date"
                        type="datetime-local"
                      />
                      <input
                        value={this.state.newDescriptionLink}
                        onChange={(e) => {
                          this.setState({ newDescriptionLink: e.target.value });
                        }}
                        required={true}
                        placeholder="description link"
                      />
                      <input
                        value={this.state.newLocation}
                        onChange={(e) => {
                          this.setState({ newLocation: e.target.value });
                        }}
                        required={true}
                        placeholder="location"
                      />
                      <input
                        value={this.state.newDepartment}
                        onChange={(e) => {
                          this.setState({ newDepartment: e.target.value });
                        }}
                        required={true}
                        placeholder="department"
                      />
                      <input
                        value={this.state.newSchool}
                        onChange={(e) => {
                          this.setState({ newSchool: e.target.value });
                        }}
                        required={true}
                        placeholder="school"
                      />
                      <button className="btn btn-primary" type="submit">
                        Create Event
                      </button>
                    </form>
                  </div>

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
                            .sort((a, b) => new Date(a.date) - new Date(b.date))
                            .map((x) => {
                              return (
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
                                  {/*this.state.selectedEvent === x.id && (
                        <Image src={QRCode.toDataURL(x.id)} />
                      )*/}
                                  {this.state.selectedEvent === x.id &&
                                    this.state.user.admin && (
                                      <td>
                                        <form
                                          onSubmit={(e) => {
                                            e.preventDefault();

                                            // Register Font
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
                                    )}
                                </tr>
                              );
                            })
                        )}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
              <div className="app-links">
                <a
                  href="#"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-primary"
                  style={{ fontSize: "12px", textDecoration: "none" }}
                >
                  App Store
                </a>
                <a
                  href="#"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-primary"
                  style={{ fontSize: "12px", textDecoration: "none" }}
                >
                  Play Store
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
}
