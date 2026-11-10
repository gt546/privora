import { initializeApp } from
"https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import {
    getAuth,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut
} from
"https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
    getFirestore,
    doc,
    getDoc,
    getDocs,
    runTransaction,
    serverTimestamp,
    collection,
    query,
    where,
    onSnapshot,
    setDoc,
    updateDoc,
    deleteDoc
} from
"https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
// FIREBASE CONFIGURATION

const firebaseConfig = {
  apiKey: "AIzaSyBfwZAWz_ZA8k1tMIXnZMOCZ_OKElXdZ5Y",
  authDomain: "chating-4f317.firebaseapp.com",
  databaseURL: "https://chating-4f317-default-rtdb.firebaseio.com",
  projectId: "chating-4f317",
  storageBucket: "chating-4f317.firebasestorage.app",
  messagingSenderId: "774716815154",
  appId: "1:774716815154:web:b85a2dfaf455932b51892b",
  measurementId: "G-WXZ1JB32E8"
};


// INITIALIZE FIREBASE

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);


// HTML ELEMENTS

const loginPage = document.getElementById("loginPage");
const dashboardPage = document.getElementById("dashboardPage");

const loginForm = document.getElementById("loginForm");
const signupForm = document.getElementById("signupForm");

const errorBox = document.getElementById("error");

const fullNameInput = document.getElementById("fullName");
const usernameInput = document.getElementById("newUsername");
const signupEmailInput = document.getElementById("signupEmail");
const signupPasswordInput = document.getElementById("signupPassword");
const confirmPasswordInput = document.getElementById("confirmPassword");

const signupBtn = document.getElementById("signupBtn");
const loginBtn = document.getElementById("loginBtn");

let currentUser = null;
let currentUserProfile = null;


// PAGE CONTROL

function showDashboard(profile) {

    loginPage.hidden = true;
    dashboardPage.hidden = false;

    currentUserProfile = profile;

    document.getElementById("profileFullName").textContent =
        profile.fullName || "User";

    document.getElementById("profileUsername").textContent =
        "@" + (profile.username || "");

    document.getElementById("profilePrivoraId").textContent =
        profile.privoraId || "";

    document.getElementById("profileAvatar").textContent =
        (profile.fullName || "U").charAt(0).toUpperCase();

    document.getElementById("searchUsername").value = "";
    document.getElementById("searchResults").innerHTML = "";


    startFollowSystem();
}


// GENERATE UNIQUE PRIVORA ID

function generatePrivoraID() {

    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

    const randomValues =
        crypto.getRandomValues(new Uint8Array(8));

    let code = "";

    for (const value of randomValues) {
        code += chars[value % chars.length];
    }

    return "PRV-" + code;

}


// LOGIN

loginBtn.addEventListener("click", async () => {

    const email =
        document.getElementById("userId").value.trim();

    const password =
        document.getElementById("password").value;

    errorBox.textContent = "";
    errorBox.style.color = "";

    if (!email || !password) {
        errorBox.textContent = "Enter email and password.";
        return;
    }

    loginBtn.disabled = true;
    loginBtn.textContent = "Logging in...";

    try {

        const result = await signInWithEmailAndPassword(
            auth,
            email,
            password
        );

        currentUser = result.user;

        const profileRef = doc(
            db,
            "users",
            currentUser.uid
        );

        const profileSnap = await getDoc(profileRef);

        if (!profileSnap.exists()) {
            throw new Error("PRIVORA_PROFILE_NOT_FOUND");
        }

        showDashboard(profileSnap.data());

    }

    catch (error) {

        console.error("LOGIN ERROR:", error);

        if (auth.currentUser) {
            await signOut(auth);
        }

        currentUser = null;

        errorBox.textContent =
            error.message === "PRIVORA_PROFILE_NOT_FOUND"
                ? "Your Privora profile was not found."
                : error.code + ": " + error.message;

    }

    finally {

        loginBtn.disabled = false;
        loginBtn.textContent = "Login";

    }

});


// SWITCH LOGIN / SIGNUP

document.getElementById("showSignup")
.addEventListener("click", (event) => {

    event.preventDefault();

    loginForm.hidden = true;
    signupForm.hidden = false;

    errorBox.textContent = "";

});


document.getElementById("showLogin")
.addEventListener("click", (event) => {

    event.preventDefault();

    signupForm.hidden = true;
    loginForm.hidden = false;

    errorBox.textContent = "";

});


// SIGNUP

signupBtn.addEventListener("click", async () => {

    const fullName = fullNameInput.value.trim();
    const username = usernameInput.value.trim();
    const usernameLower = username.toLowerCase();

    const email = signupEmailInput.value.trim();

    const password = signupPasswordInput.value;
    const confirmPassword = confirmPasswordInput.value;

    errorBox.textContent = "";
    errorBox.style.color = "";

    if (!fullName || !username || !email ||
        !password || !confirmPassword) {

        errorBox.textContent = "Please fill all fields.";
        return;
    }

    if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {

        errorBox.textContent =
            "Username must contain 3-20 letters, numbers or underscores.";

        return;
    }

    if (password.length < 8) {

        errorBox.textContent =
            "Password must contain at least 8 characters.";

        return;
    }

    if (password !== confirmPassword) {

        errorBox.textContent = "Passwords do not match.";
        return;
    }

    signupBtn.disabled = true;
    signupBtn.textContent = "Creating Account...";

    let createdUser = null;

    try {

        const result = await createUserWithEmailAndPassword(
            auth,
            email,
            password
        );

        createdUser = result.user;

        const uid = createdUser.uid;

        let profileCreated = false;

        for (let attempt = 0; attempt < 5; attempt++) {

            const privoraId = generatePrivoraID();

            const userRef = doc(db, "users", uid);

            const usernameRef = doc(
                db,
                "usernames",
                usernameLower
            );

            const privoraIdRef = doc(
                db,
                "privoraIds",
                privoraId
            );

            const reserved = await runTransaction(
                db,
                async (transaction) => {

                    const usernameSnap =
                        await transaction.get(usernameRef);

                    const idSnap =
                        await transaction.get(privoraIdRef);

                    if (usernameSnap.exists()) {
                        throw new Error("USERNAME_TAKEN");
                    }

                    if (idSnap.exists()) {
                        return false;
                    }

                    const timestamp = serverTimestamp();

                    transaction.set(userRef, {
                        fullName,
                        username,
                        usernameLower,
                        privoraId,
                        createdAt: timestamp
                    });

                    transaction.set(usernameRef, {
                        uid,
                        username,
                        usernameLower,
                        privoraId,
                        createdAt: timestamp
                    });

                    transaction.set(privoraIdRef, {
                        uid,
                        createdAt: timestamp
                    });

                    return true;

                }
            );

            if (reserved) {
                profileCreated = true;
                break;
            }

        }

        if (!profileCreated) {
            throw new Error("ID_GENERATION_FAILED");
        }
        await signOut(auth);

        currentUser = null;

        signupForm.hidden = true;
        loginForm.hidden = false;

        document.getElementById("userId").value = email;
        document.getElementById("password").value = "";

        fullNameInput.value = "";
        usernameInput.value = "";
        signupEmailInput.value = "";
        signupPasswordInput.value = "";
        confirmPasswordInput.value = "";

        errorBox.style.color = "green";

        errorBox.textContent =
            "Account created successfully! Please login.";

    }

    catch (error) {

        console.error("SIGNUP ERROR:", error);

        if (createdUser && auth.currentUser) {
            await signOut(auth);
        }

        if (error.message === "USERNAME_TAKEN") {

            errorBox.textContent =
                "This username is already taken.";

        } else if (error.message === "ID_GENERATION_FAILED") {

            errorBox.textContent =
                "Could not generate Privora ID. Try again.";

        } else {

            errorBox.textContent =
                error.code
                    ? error.code + ": " + error.message
                    : error.message;

        }

        currentUser = null;

    }

    finally {

        signupBtn.disabled = false;
        signupBtn.textContent = "Create Account";

    }

});


// SEARCH USERS BY USERNAME

document.getElementById("searchUserBtn")
.addEventListener("click", searchUser);

document.getElementById("searchUsername")
.addEventListener("keydown", (event) => {

    if (event.key === "Enter") {
        searchUser();
    }

});


async function searchUser() {

    const username = document
        .getElementById("searchUsername")
        .value.trim()
        .toLowerCase();

    const results = document.getElementById("searchResults");

    results.innerHTML = "";

    if (!currentUser) {
        results.textContent = "Please login first.";
        return;
    }

    if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
        results.textContent = "Enter a valid username.";
        return;
    }

    const searchBtn =
        document.getElementById("searchUserBtn");

    searchBtn.disabled = true;
    searchBtn.textContent = "Searching...";

    try {

        const usernameRef = doc(
            db,
            "usernames",
            username
        );

        const usernameSnap = await getDoc(usernameRef);

        if (!usernameSnap.exists()) {

            results.textContent = "No user found.";
            return;
        }

        const userData = usernameSnap.data();

        if (userData.uid === currentUser.uid) {

            results.textContent = "This is your own account.";
            return;
        }

        const profileRef = doc(
            db,
            "users",
            userData.uid
        );

        const profileSnap = await getDoc(profileRef);

        if (!profileSnap.exists()) {

            results.textContent = "User profile unavailable.";
            return;
        }

        const profile = profileSnap.data();

        const card = document.createElement("div");
        card.className = "search-result";

        const name = document.createElement("h4");
        name.textContent = profile.fullName;

        const handle = document.createElement("p");
        handle.textContent = "@" + profile.username;

        const id = document.createElement("small");
        id.textContent = profile.privoraId;

       const followBtn = document.createElement("button");

const outgoingId =
    currentUser.uid + "_" + userData.uid;

const incomingId =
    userData.uid + "_" + currentUser.uid;

const outgoingRef = doc(db, "followRequests", outgoingId);
const incomingRef = doc(db, "followRequests", incomingId);

const [outgoingSnap, incomingSnap] = await Promise.all([
    getDoc(outgoingRef),
    getDoc(incomingRef)
]);

if (
    (outgoingSnap.exists() &&
     outgoingSnap.data().status === "accepted") ||
    (incomingSnap.exists() &&
     incomingSnap.data().status === "accepted")
) {
    followBtn.textContent = "Friends";
    followBtn.disabled = true;
}
else if (
    incomingSnap.exists() &&
    incomingSnap.data().status === "pending"
) {
    followBtn.textContent = "Accept Request";

    followBtn.addEventListener("click", async () => {
        await acceptFollowRequest(incomingId);
    });
}
else if (
    outgoingSnap.exists() &&
    outgoingSnap.data().status === "pending"
) {
    followBtn.textContent = "Request Sent";
    followBtn.disabled = true;
}
else {
    followBtn.textContent = "Follow";

    followBtn.addEventListener("click", async () => {
        await sendFollowRequest(userData.uid);
        followBtn.textContent = "Request Sent";
        followBtn.disabled = true;
    });
}

card.append(name, handle, id, followBtn);
results.appendChild(card);

    }

    catch (error) {

        console.error("SEARCH ERROR:", error);

        results.textContent =
            "Search failed: " + error.message;

    }

    finally {

        searchBtn.disabled = false;
        searchBtn.textContent = "Search";

    }

}


// LOGOUT

document.getElementById("logoutBtn")
.addEventListener("click", async () => {

    try {
stopFollowSystem();
        await signOut(auth);

        currentUser = null;
        currentUserProfile = null;

        dashboardPage.hidden = true;
        loginPage.hidden = false;

        document.getElementById("password").value = "";

        errorBox.textContent = "";

    }

    catch (error) {

        console.error("LOGOUT ERROR:", error);

        alert("Logout failed: " + error.message);

    }

});


console.log("PRIVORA DASHBOARD INITIALIZED");
// ==========================================
// PRIVORA FOLLOW REQUEST SYSTEM
// ==========================================

let followListeners = [];


// STOP FOLLOW LISTENERS

function stopFollowSystem() {

    followListeners.forEach(unsubscribe => unsubscribe());

    followListeners = [];

    document.getElementById("followRequestsList").innerHTML = "";
    document.getElementById("myFriendsList").innerHTML = "";

}


// START FOLLOW SYSTEM

function startFollowSystem() {

    stopFollowSystem();

    if (!currentUser) return;

    const uid = currentUser.uid;

    // Incoming pending requests

    const incomingQuery = query(
        collection(db, "followRequests"),
        where("receiver", "==", uid),
        where("status", "==", "pending")
    );

    const incomingListener = onSnapshot(
        incomingQuery,
        snapshot => renderIncomingRequests(snapshot),
        error => console.error("REQUEST LIST ERROR:", error)
    );

    // Accepted incoming friends

    const acceptedIncomingQuery = query(
        collection(db, "followRequests"),
        where("receiver", "==", uid),
        where("status", "==", "accepted")
    );

    const acceptedIncomingListener = onSnapshot(
        acceptedIncomingQuery,
        snapshot => renderFriends(),
        error => console.error("FRIENDS ERROR:", error)
    );

    // Accepted outgoing friends

    const acceptedOutgoingQuery = query(
        collection(db, "followRequests"),
        where("sender", "==", uid),
        where("status", "==", "accepted")
    );

    const acceptedOutgoingListener = onSnapshot(
        acceptedOutgoingQuery,
        snapshot => renderFriends(),
        error => console.error("FRIENDS ERROR:", error)
    );

    followListeners.push(
        incomingListener,
        acceptedIncomingListener,
        acceptedOutgoingListener
    );

}


// SEND FOLLOW REQUEST

async function sendFollowRequest(receiverUid) {

    if (!currentUser || receiverUid === currentUser.uid) return;

    const requestId = currentUser.uid + "_" + receiverUid;

    const requestRef = doc(
        db,
        "followRequests",
        requestId
    );

    try {

        const existing = await getDoc(requestRef);

        if (existing.exists()) {

            alert("Follow request already exists.");
            return;

        }

        await setDoc(requestRef, {
            sender: currentUser.uid,
            receiver: receiverUid,
            status: "pending",
            createdAt: serverTimestamp()
        });

        alert("Follow request sent successfully!");

    }

    catch (error) {

        console.error("FOLLOW ERROR:", error);

        alert("Request failed: " + error.message);

        throw error;

    }

}


// ACCEPT REQUEST

async function acceptFollowRequest(requestId) {

    try {

        await updateDoc(
            doc(db, "followRequests", requestId),
            {
                status: "accepted"
            }
        );

        alert("Friend request accepted!");

    }

    catch (error) {

        console.error("ACCEPT ERROR:", error);

        alert("Could not accept request: " + error.message);

    }

}


// REJECT REQUEST

async function rejectFollowRequest(requestId) {

    const confirmed = confirm(
        "Are you sure you want to reject this request?"
    );

    if (!confirmed) return;

    try {

        await deleteDoc(
            doc(db, "followRequests", requestId)
        );

    }

    catch (error) {

        console.error("REJECT ERROR:", error);

        alert("Could not reject request: " + error.message);

    }

}


// CREATE PERSON CARD

async function createPersonCard(uid, actionButtons = []) {

    const profileSnap = await getDoc(
        doc(db, "users", uid)
    );

    if (!profileSnap.exists()) return null;

    const profile = profileSnap.data();

    const card = document.createElement("div");
    card.className = "search-result";

    const name = document.createElement("h4");
    name.textContent = profile.fullName || "User";

    const username = document.createElement("p");
    username.textContent = "@" + (profile.username || "");

    const id = document.createElement("small");
    id.textContent = profile.privoraId || "";

    card.append(name, username, id);

    actionButtons.forEach(button => {
        card.appendChild(button);
    });

    return card;

}


// RENDER INCOMING REQUESTS

async function renderIncomingRequests(snapshot) {

    const container =
        document.getElementById("followRequestsList");

    container.innerHTML = "";

    if (snapshot.empty) {

        container.innerHTML =
            '<p class="empty-message">No pending requests.</p>';

        return;

    }

    for (const requestDoc of snapshot.docs) {

        const data = requestDoc.data();

        const acceptBtn = document.createElement("button");
        acceptBtn.textContent = "Accept";

        acceptBtn.addEventListener("click", () => {
            acceptFollowRequest(requestDoc.id);
        });

        const rejectBtn = document.createElement("button");
        rejectBtn.textContent = "Reject";
        rejectBtn.className = "reject-btn";

        rejectBtn.addEventListener("click", () => {
            rejectFollowRequest(requestDoc.id);
        });

        const card = await createPersonCard(
            data.sender,
            [acceptBtn, rejectBtn]
        );

        if (card) container.appendChild(card);

    }

}


// RENDER MY FRIENDS

async function renderFriends() {

    if (!currentUser) return;

    const container =
        document.getElementById("myFriendsList");

    const uid = currentUser.uid;

    try {

        const incomingQuery = query(
            collection(db, "followRequests"),
            where("receiver", "==", uid),
            where("status", "==", "accepted")
        );

        const outgoingQuery = query(
            collection(db, "followRequests"),
            where("sender", "==", uid),
            where("status", "==", "accepted")
        );

        const [incoming, outgoing] = await Promise.all([
            getDocs(incomingQuery),
            getDocs(outgoingQuery)
        ]);

        const friendIds = new Set();

        incoming.forEach(item => {
            friendIds.add(item.data().sender);
        });

        outgoing.forEach(item => {
            friendIds.add(item.data().receiver);
        });

        container.innerHTML = "";

        if (friendIds.size === 0) {

            container.innerHTML =
                '<p class="empty-message">No friends yet.</p>';

            return;

        }

        for (const friendUid of friendIds) {

            const card = await createPersonCard(friendUid);

            if (card) container.appendChild(card);

        }

    }

    catch (error) {

        console.error("FRIENDS LOADING ERROR:", error);

        container.textContent =
            "Could not load friends: " + error.message;

    }

}