//import { getAuth } from "firebase/auth";
//import "firebase/firestore";

import { initializeApp } from "firebase/app";
import "firebase/firestore";
import "firebase/auth";
import "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyCWJhSxNcZy47olr8ucuqj2pcwghNngI2Q",
  authDomain: "passport-s0989374.firebaseapp.com",
  projectId: "passport-s0989374",
  storageBucket: "passport-s0989374.firebasestorage.app",
  messagingSenderId: "712511258077",
  appId: "1:712511258077:web:1299fd76239228cea34a34",
};
//if (!firebase.apps.length) {
//const auth = getAuth(firebase);
//firebase && firebase.auth && firebase.auth().useDeviceLanguage();
//firebase.firestore().enablePersistence(false);
//}
//firebase.firestore().enablePersistence({ synchronizeTabs: true });
//firebase.auth();
//firebase.storage();
/*.settings({
  cacheSizeBytes: 1048576
});*/
//firebase.firestore().settings({ persistence: false });

/*export default function firebase() {
  return firb;
}*/

const firebase = initializeApp(firebaseConfig);
export default firebase;
