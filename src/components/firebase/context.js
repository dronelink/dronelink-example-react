/*
 * Created by Jim McAndrew on 1/20/2020
 *
 * Copyright (c) 2020 Dronelink, LLC
 */
import React from "react"

const FirebaseContext = React.createContext(null)

export const withFirebase = Component => props => <FirebaseContext.Consumer>{firebase => <Component {...props} firebase={firebase} />}</FirebaseContext.Consumer>

export default FirebaseContext
