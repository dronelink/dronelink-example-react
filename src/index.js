import React from "react"
import ReactDOM from "react-dom"

import App from "./App"
import Firebase, { FirebaseContext } from "./components/firebase"

ReactDOM.render(
    <FirebaseContext.Provider value={process.env.REACT_APP_FIREBASE_REPOSITORY_DATABASE_PATH ? new Firebase() : null}>
        <App />
    </FirebaseContext.Provider>,
    document.getElementById("root")
)
