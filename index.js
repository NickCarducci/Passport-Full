require("dotenv").config();

const path = require("path"),
  port = 8080,
  allowedOrigins = ["https://z2xlch.csb.app"], //Origin: <scheme>://<hostname>:<port>
  RESSEND = (res, e) => {
    res.send(e);
    //res.end();
  },
  refererOrigin = (req, res) => {
    var origin = req.query.origin;
    if (!origin) {
      origin = req.headers.origin;
      //"no newaccount made body",  //...printObject(req) //: origin + " " + (storeId ? "storeId" : "")
    }
    return origin;
  },
  allowOriginType = (origin, req, res) => {
    res.setHeader(
      "Access-Control-Allow-Origin",
      req.path.includes("/attend") ? "*" : origin
    );
    res.setHeader("Access-Control-Allow-Methods", ["POST", "OPTIONS", "GET"]);
    res.setHeader("Access-Control-Allow-Headers", [
      "Content-Type",
      "Access-Control-Request-Method",
      "Access-Control-Request-Methods",
      "Access-Control-Request-Headers"
    ]);
    //if (res.secure) return null;
    //allowedOrigins[allowedOrigins.indexOf(origin)]
    res.setHeader("Allow", ["POST", "OPTIONS", "GET"]);
    res.setHeader("Content-Type", "Application/JSON");
    var goAhead = true;
    if (!goAhead) return true;
    //if (!res.secure) return true;
    //https://stackoverflow.com/questions/12027187/difference-between-allow-and-access-control-allow-methods-in-http-response-h
  },
  preflight = (req, res) => {
    const origin = req.headers.origin;
    app.use(cors({ origin })); //https://stackoverflow.com/questions/36554375/getting-the-req-origin-in-express
    if (
      [
        ...(req.path.includes("/users") ||
        req.path.includes("/create") ||
        req.path.includes("/delete")
          ? allowedOrigins
          : [req.headers.origin])
      ].indexOf(req.headers.origin) === -1
    )
      return res.send({
        statusCode: 401,
        error: "no access for this origin- " + req.headers.origin
      });
    if (allowOriginType(origin, req, res))
      return res.send({
        statusCode,
        statusText: "not a secure origin-referer-to-host protocol"
      });
    //"Cannot setHeader headers after they are sent to the client"

    res.send({
      statusCode: 204
    }); //res.sendStatus(200);
  },
  //const printObject = (o) => Object.keys(o).map((x) => {return {[x]: !o[x] ? {} : o[x].constructor === Object ? printObject(o[x]) : o[x] };});
  standardCatch = (res, e, extra, name) => {
    RESSEND(res, {
      statusCode: 402,
      statusText: "no caught",
      name,
      error: e,
      extra
    });
  },
  timeout = require("connect-timeout"),
  //fetch = require("node-fetch"),
  express = require("express"),
  app = express(),
  issue = express.Router(),
  cors = require("cors"),
  { initializeApp, applicationDefault, cert } = require("firebase-admin/app"),
  {
    getFirestore,
    Timestamp,
    FieldValue,
    Filter
  } = require("firebase-admin/firestore");
//FIREBASEADMIN = FIREBASEADMIN.toSource(); //https://dashboard.stripe.com/account/apikeys
//serviceAccount = require('./passport-service.json');
/*fs = require('fs');

fs.writeFile('/firebaseService', process.env.firebaseService, err => {
  if (err) {
    console.error(err);
  } else {
    // file written successfully
    /*const serviceAccount = require('./firebaseService.json');
    initializeApp({
      credential: cert(serviceAccount)
    });* /
    initializeApp({
      credential: applicationDefault()//cert(jsonData)
    });
  }
});*/
//const serviceAccount = require('./passport-service.json');
//const jsonData = JSON.parse(process.env.FIREBASE_SERVICE);
const jsonData = require("./passport-service.json");
initializeApp({
  credential: cert(jsonData)
});
const db = getFirestore();

app.use(timeout("10s"));
//catches ctrl+c event
process.on("SIGINT", exitHandler.bind(null, { exit: true }));
// catches "kill pid" (for example: nodemon restart)
process.on("SIGUSR1", exitHandler.bind(null, { exit: true }));
process.on("SIGUSR2", exitHandler.bind(null, { exit: true }));
//https://stackoverflow.com/questions/14031763/doing-a-cleanup-action-just-before-node-js-exits
//http://johnzhang.io/options-req-in-express
//var origin = req.get('origin');

const nonbody = express
  .Router()
  .get("/", (req, res) => res.status(200).send("home path"))
  .options("/*", preflight);

app.use(express.urlencoded({ extended: false }));
app.use(express.json());

var statusCode = 200,
  statusText = "ok";
//https://support.stripe.com/questions/know-your-customer-(kyc)-requirements-for-connected-accounts
issue
  /*.post("/leaderboard", async (req, res) => {
    if (allowOriginType(req.headers.origin, req, res))
      return RESSEND(res, {
        statusCode,
        statusText: "not a secure origin-referer-to-host protocol"
      });
    const snapshot = db.collection('leaders')
      .orderBy('eventsAttended', 'desc').limit(10).get()
    if (snapshot.empty) {
      return res.send({
        statusCode,
        statusText,
        leaders: []
      })
    }
    res.send({
      statusCode,
      statusText,
      leaders: snapshot.map(doc => {
        const dc = doc.data();
        return {
          id: doc.id, eventsAttended: dc.eventsAttended,
          fullName: dc.fullName, username: dc.username
        }
      })

    });
  })
  .post("/create", async (req, res) => {
    if (allowOriginType(req.headers.origin, req, res))
      return RESSEND(res, {
        statusCode,
        statusText: "not a secure origin-referer-to-host protocol"
      });
      const res = await db.collection('events').add({
        title: req.body.title,
        date: req.body.date,
        descriptionLink: req.body.descriptionLink,
        location: req.body.location,
        department: req.body.department,
        school: req.body.school,
        attendees: [],
      });
      res.send({
        statusCode,
        statusText,
        message: res.id + " event created."
      })
  })
  .post("/delete", async (req, res) => {
    if (allowOriginType(req.headers.origin, req, res))
      return RESSEND(res, {
        statusCode,
        statusText: "not a secure origin-referer-to-host protocol"
      });
    const res = await db.collection('events').doc(req.body.eventId).delete();
    res.send({
      statusCode,
      statusText,
      message: res.id + " event deleted."
    });
  })
  .post("/list", async (req, res) => {
    if (allowOriginType(req.headers.origin, req, res))
      return RESSEND(res, {
        statusCode,
        statusText: "not a secure origin-referer-to-host protocol"
      });
    const snapshot = db.collection('cities').get()
    if (snapshot.empty) {
      return res.send({
        statusCode,
        statusText,
        events: []
      })
    }
    res.send({
      statusCode,
      statusText,
      events: snapshot.map(doc => {
        return { id: doc.id, ...doc.data() }
      })
    })
  })*/
  .post("/attend", async (req, res) => {
    if (allowOriginType(req.headers.origin, req, res))
      return RESSEND(res, {
        statusCode,
        statusText: "not a secure origin-referer-to-host protocol"
      });
    const evenT = await db.collection("events").doc(req.body.eventId).get();

    if (!evenT.exists) {
      console.log(req.body.eventId + " event doesn't exist.");
      //console.log((await evenT).data());
      return res.send({
        statusCode,
        statusText,
        message: req.body.eventId + " event doesn't exist",
        title: ""
      });
    }
    const event = evenT.data();
    console.log(req.body.studentId + " student.");
    if (event.attendees.includes(req.body.studentId)) {
      console.log("already attended.");
      return res.send({
        statusCode,
        statusText,
        message: "already attended.",
        title: event.title
      });
    }
    await db
      .collection("events")
      .doc(req.body.eventId)
      .update({
        attendees: FieldValue.arrayUnion(req.body.studentId)
      });
    await db
      .collection("leaders")
      .doc(req.body.studentId)
      .set(
        {
          eventsAttended: FieldValue.increment(1),
          address: req.body.address || "",
          fullName: req.body.fullName || "",
          username: req.body.username || ""
        },
        { merge: true }
      );
    res.send({
      statusCode,
      statusText,
      message: "attended",
      title: event.title
    });
  });
//https://stackoverflow.com/questions/31928417/chaining-multiple-pieces-of-middleware-for-specific-route-in-expressjs
app.use("/api", nonbody, issue); //methods on express.Router() or use a scoped instance

app.get("/health", (req, res) => res.status(200).send("ok"));

app.listen(port, () => console.log(`localhost:${port}`));
process.stdin.resume(); //so the program will not close instantly
function exitHandler(exited, exitCode) {
  if (exited) {
    //mccIdTimeoutNames.forEach((x) => clearTimeout(mccIdTimeouts[x]));
    console.log("clean");
  }
  if (exitCode || exitCode === 0) console.log(exitCode);
  if (exited.mounted) process.exit(); //bind-only not during declaration
} //bind declare (this,update) when listened on:
process.on("uncaughtException", exitHandler.bind(null, { mounted: true }));
process.on("exit", exitHandler.bind(null, { clean: true }));
function errorHandler(err, req, res, next) {
  console.log("Oops", err);
}
app.use(errorHandler);
