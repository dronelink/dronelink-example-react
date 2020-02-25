/*
 * Created by Jim McAndrew on 1/20/2020
 *
 * Copyright (c) 2020 Dronelink, LLC
 */
import FirebaseApp from "firebase/app"
import "firebase/auth"
import "firebase/firestore"
import "firebase/storage"
import "firebase/functions"
import "firebase/performance"
import * as Dronelink from "dronelink-kernel"
import { ComponentUtils, FuncUtils } from "react-dronelink"

const config = {
    apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
    authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
    databaseURL: process.env.REACT_APP_FIREBASE_DATABASE_URL,
    projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
    storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.REACT_APP_FIREBASE_APP_ID,
    measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID
}

class Firebase {
    constructor() {
        FirebaseApp.initializeApp(config)
        this.firestore = FirebaseApp.firestore()
    }

    static sortDocsByDate = (docs, dateFieldName, ascending) => {
        return docs.sort((a, b) => {
            const left = (ascending ? a : b).data()
            const right = (ascending ? b : a).data()
            return left[dateFieldName].toDate().getTime() - right[dateFieldName].toDate().getTime()
        })
    }

    root = () => process.env.REACT_APP_FIREBASE_REPOSITORY_DATABASE_PATH

    doc(collection, id) {
        if (id) {
            return collection.doc(id)
        }
        return collection.doc()
    }

    incrementCounter = (targetRef, counterName) => {
        targetRef.update({
            [counterName]: FirebaseApp.firestore.FieldValue.increment(1)
        })
    }

    components = type => this.firestore.collection(`${this.root()}/${type === Dronelink.TypeName.PlanComponent ? "plans" : "subComponents"}`)
    component = (type, id) => this.doc(this.components(type), id)
    componentVersions = (type, id) => this.component(type, id).collection("versions")
    componentLatestVersion = (type, id) =>
        this.componentVersions(type, id)
            .orderBy("created", "desc")
            .limit(1)

    incrementComponentIncludes = componentRef => {
        return this.incrementCounter(componentRef, "includes")
    }

    createComponent = (componentRef, component, copiedComponentRef) => {
        const batch = this.firestore.batch()
        batch.set(componentRef, {
            type: component.type,
            coordinate: new FirebaseApp.firestore.GeoPoint(component.coordinate.latitude, component.coordinate.longitude),
            name: component.descriptors.name,
            description: component.descriptors.description,
            tags: component.descriptors.tags,
            created: FirebaseApp.firestore.FieldValue.serverTimestamp(),
            updated: FirebaseApp.firestore.FieldValue.serverTimestamp(),
            touched: FirebaseApp.firestore.FieldValue.serverTimestamp(),
            details: ComponentUtils.details(component),
            copies: 0,
            includes: 0,
            copiedComponent: copiedComponentRef ? copiedComponentRef : null
        })

        const componentVersionRef = componentRef.collection("versions").doc()
        batch.set(componentVersionRef, {
            created: FirebaseApp.firestore.FieldValue.serverTimestamp(),
            updated: FirebaseApp.firestore.FieldValue.serverTimestamp(),
            delta: Dronelink.Common.uuid(),
            locked: null
        })

        //KLUGE: handle mobile device large component creation (copying, etc)
        //if we do this as part of the above set operation, it always seems to fail on mobile devices!!!
        batch.update(componentVersionRef, {
            content: Dronelink.Serialization.write(component)
        })

        if (copiedComponentRef) {
            batch.update(copiedComponentRef, {
                copies: FirebaseApp.firestore.FieldValue.increment(1)
            })
        }

        return batch.commit()
    }

    touchComponent = componentRef => {
        return componentRef.update({ touched: FirebaseApp.firestore.FieldValue.serverTimestamp() })
    }

    updateComponent = (componentRef, component, componentVersionRef, componentVersionDelta) => {
        const batch = this.firestore.batch()
        batch.update(componentRef, {
            type: component.type,
            coordinate: new FirebaseApp.firestore.GeoPoint(component.coordinate.latitude, component.coordinate.longitude),
            name: component.descriptors.name,
            description: component.descriptors.description,
            tags: component.descriptors.tags,
            updated: FirebaseApp.firestore.FieldValue.serverTimestamp(),
            touched: FirebaseApp.firestore.FieldValue.serverTimestamp(),
            details: ComponentUtils.details(component)
        })

        const content = Dronelink.Serialization.write(component)
        componentVersionDelta = componentVersionDelta ? componentVersionDelta : null
        if (componentVersionRef) {
            batch.update(componentVersionRef, {
                updated: FirebaseApp.firestore.FieldValue.serverTimestamp(),
                content: content,
                delta: componentVersionDelta,
                locked: null
            })
        } else {
            batch.set(componentRef.collection("versions").doc(), {
                created: FirebaseApp.firestore.FieldValue.serverTimestamp(),
                updated: FirebaseApp.firestore.FieldValue.serverTimestamp(),
                content: content,
                delta: componentVersionDelta,
                locked: null
            })
        }

        return batch.commit()
    }

    deleteComponent = (componentRef, componentType) => {
        const batch = this.firestore.batch()
        batch.delete(componentRef)
        return componentRef
            .collection("versions")
            .get()
            .then(versions => {
                versions.forEach(version => {
                    batch.delete(version.ref)
                })

                return batch.commit()
            })
    }

    deleteComponentVersions = componentVersionRefs => {
        const batch = this.firestore.batch()
        componentVersionRefs.forEach(componentVersionRef => {
            batch.delete(componentVersionRef)
        })
        return batch.commit()
    }

    deleteComponentVersion = componentVersionRef => {
        return this.deleteComponentVersions([componentVersionRef])
    }

    lockComponentVersion = componentVersionRef => {
        return componentVersionRef.update({ locked: FirebaseApp.firestore.FieldValue.serverTimestamp() })
    }

    funcs = () => this.firestore.collection(`${this.root()}/funcs`)
    func = id => this.doc(this.funcs(), id)
    funcVersions = id => this.func(id).collection("versions")
    funcLatestVersion = id =>
        this.funcVersions(id)
            .orderBy("created", "desc")
            .limit(1)

    createFunc = (funcRef, func, copiedFuncRef) => {
        const batch = this.firestore.batch()
        batch.set(funcRef, {
            coordinate: new FirebaseApp.firestore.GeoPoint(func.coordinate.latitude, func.coordinate.longitude),
            name: func.descriptors.name,
            description: func.descriptors.description,
            tags: func.descriptors.tags,
            created: FirebaseApp.firestore.FieldValue.serverTimestamp(),
            updated: FirebaseApp.firestore.FieldValue.serverTimestamp(),
            touched: FirebaseApp.firestore.FieldValue.serverTimestamp(),
            details: FuncUtils.details(func),
            copies: 0,
            copiedFunc: copiedFuncRef ? copiedFuncRef : null
        })

        const funcVersionRef = funcRef.collection("versions").doc()
        batch.set(funcVersionRef, {
            created: FirebaseApp.firestore.FieldValue.serverTimestamp(),
            updated: FirebaseApp.firestore.FieldValue.serverTimestamp(),
            delta: Dronelink.Common.uuid(),
            locked: null
        })

        //KLUGE: handle mobile device large func creation (copying, etc)
        //if we do this as part of the above set operation, it always seems to fail on mobile devices!!!
        batch.update(funcVersionRef, {
            content: Dronelink.Serialization.write(func)
        })

        if (copiedFuncRef) {
            batch.update(copiedFuncRef, {
                copies: FirebaseApp.firestore.FieldValue.increment(1)
            })
        }

        return batch.commit()
    }

    touchFunc = funcRef => {
        return funcRef.update({ touched: FirebaseApp.firestore.FieldValue.serverTimestamp() })
    }

    updateFunc = (funcRef, func, funcVersionRef, funcVersionDelta) => {
        const batch = this.firestore.batch()
        batch.update(funcRef, {
            coordinate: new FirebaseApp.firestore.GeoPoint(func.coordinate.latitude, func.coordinate.longitude),
            name: func.descriptors.name,
            description: func.descriptors.description,
            tags: func.descriptors.tags,
            updated: FirebaseApp.firestore.FieldValue.serverTimestamp(),
            touched: FirebaseApp.firestore.FieldValue.serverTimestamp(),
            details: FuncUtils.details(func)
        })

        const content = Dronelink.Serialization.write(func)
        funcVersionDelta = funcVersionDelta ? funcVersionDelta : null
        if (funcVersionRef) {
            batch.update(funcVersionRef, {
                updated: FirebaseApp.firestore.FieldValue.serverTimestamp(),
                content: content,
                delta: funcVersionDelta,
                locked: null
            })
        } else {
            batch.set(funcRef.collection("versions").doc(), {
                created: FirebaseApp.firestore.FieldValue.serverTimestamp(),
                updated: FirebaseApp.firestore.FieldValue.serverTimestamp(),
                content: content,
                delta: funcVersionDelta,
                locked: null
            })
        }

        return batch.commit()
    }

    deleteFunc = funcRef => {
        const batch = this.firestore.batch()
        batch.delete(funcRef)
        return funcRef
            .collection("versions")
            .get()
            .then(versions => {
                versions.forEach(version => {
                    batch.delete(version.ref)
                })

                return batch.commit()
            })
    }

    deleteFuncVersions = funcVersionRefs => {
        const batch = this.firestore.batch()
        funcVersionRefs.forEach(funcVersionRef => {
            batch.delete(funcVersionRef)
        })
        return batch.commit()
    }

    deleteFuncVersion = funcVersionRef => {
        return this.deleteFuncVersions([funcVersionRef])
    }

    lockFuncVersion = funcVersionRef => {
        return funcVersionRef.update({ locked: FirebaseApp.firestore.FieldValue.serverTimestamp() })
    }
}

export default Firebase
