const firebaseConfig = {
  apiKey: "AIzaSyAiVuj7E_7ucDn1Z9cwEb6s-JGjYfL4R88",
  authDomain: "school-b94ef.firebaseapp.com",
  projectId: "school-b94ef",
  storageBucket: "school-b94ef.firebasestorage.app",
  messagingSenderId: "741358978976",
  appId: "1:741358978976:web:1caec1b97a2faa10b446c5",
  measurementId: "G-PR4H0MR1VS"
};

const FIREBASE_CONFIGURED = firebaseConfig.apiKey !== "YOUR_API_KEY";

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
db.settings({ experimentalAutoDetectLongPolling: true, merge: true });
