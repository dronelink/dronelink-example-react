/*
 * Created by Jim McAndrew on 2/5/2020
 *
 * Copyright (c) 2020 Dronelink, LLC
 */
import React, { Component, Fragment } from "react"
import { compose } from "recompose"
import Moment from "react-moment"
import { withStyles } from "@material-ui/core/styles"
import { TextField, InputAdornment, Button, Typography, Card, CardContent, CardActionArea, CardHeader, Avatar, LinearProgress } from "@material-ui/core"
import { Search as FilterIcon, Add as AddIcon, KeyboardArrowRight as ViewIcon, CloudUpload as ImportIcon } from "@material-ui/icons"
import { ApplicationVariableOutline as InputIcon, FunctionVariant as FuncIcon, LanguageJavascript as LinesIcon, LightbulbOnOutline as EmptyIcon } from "mdi-material-ui"
import FuncPinImage from "../../assets/img/func-pin.png"
import { FuncUtils, MapUtils, MapMarkerCollection } from "react-dronelink"
import * as Dronelink from "dronelink-kernel"
import { DescriptorsTags } from "react-dronelink"
import mapboxgl from "mapbox-gl"
import { isMobile } from "react-device-detect"
import { withFirebase } from "../../components/firebase"
import Firebase from "../../components/firebase/firebase"
import Utils from "../../components/utils"

const styles = (theme) => ({
    container: {
        width: "100%",
        display: "flex",
        flexDirection: "row",
        flexWrap: "wrap",
        padding: theme.spacing(2)
    },
    createContent: {
        display: "flex",
        alignItems: "center",
        alignContent: "center",
        flexDirection: "column"
    },
    func: {
        padding: 0,
        marginTop: theme.spacing(1),
        marginBottom: theme.spacing(1),
        width: "100%"
    },
    content: {
        paddingTop: 0,
        paddingBottom: theme.spacing(1)
    },
    avatar: {
        backgroundColor: theme.palette.primary.main
    },
    detail: {
        marginTop: theme.spacing(0.5),
        marginBottom: theme.spacing(0.5),
        display: "flex",
        alignItems: "center"
    },
    detailSpacer: {
        marginRight: theme.spacing(1.5)
    },
    detailIcon: {
        marginRight: theme.spacing(0.5)
    },
    import: {
        display: "flex",
        alignItems: "center"
    },
    action: {
        display: "flex",
        alignItems: "center"
    },
    actions: {
        justifyContent: "space-between",
        padding: 0,
        minHeight: 40
    },
    viewIcon: {
        marginTop: theme.spacing(1),
        marginRight: theme.spacing(1)
    },
    funcMarker: MapUtils.markerCSSPin(FuncPinImage),
    progress: {
        width: "100%"
    },
    empty: {
        display: "flex",
        flexDirection: "row",
        alignItems: "flex-start",
        marginRight: theme.spacing(1),
        marginTop: theme.spacing(2)
    },
    emptyIcon: {
        marginRight: theme.spacing(1)
    }
})

class FuncsBase extends Component {
    state = {
        funcs: null,
        creating: false,
        filter: null,
        limit: 100,
        importFile: null
    }

    markers = new MapMarkerCollection()

    componentDidMount() {
        const { classes, firebase } = this.props
        if (!firebase) {
            this.setState({
                funcs: false
            })
            return
        }

        this.unsubscribeFuncs = firebase.funcs().onSnapshot((snapshot) => {
            if (snapshot.metadata.hasPendingWrites) {
                return
            }

            const funcs = Firebase.sortDocsByDate(snapshot.docs, "touched")

            this.markers.refresh(
                funcs.length,
                (index) => {
                    const func = funcs[index]
                    const marker = MapUtils.elementMarkerPin(
                        classes.funcMarker,
                        false,
                        null,
                        () => {
                            window.mapWidget.onHoverMarker()
                            this.props.onOpen(func.id)
                        },
                        (e) => {
                            window.mapWidget.onHoverMarker(e, () => {
                                return func.data().name
                            })
                        }
                    )
                    marker.setLngLat([func.data().coordinate.longitude, func.data().coordinate.latitude])
                    return marker
                },
                (marker, index) => {
                    const func = funcs[index]
                    marker.setLngLat([func.data().coordinate.longitude, func.data().coordinate.latitude])
                }
            )

            this.setState({
                funcs: funcs
            })

            if (funcs.length > 0) {
                const bounds = MapUtils.bounds(funcs.map((func) => [func.data().coordinate.longitude, func.data().coordinate.latitude]))
                if (bounds) {
                    window.mapWidget.map.fitBounds(bounds, { padding: { top: 125, left: 425, right: 50, bottom: 50 }, maxZoom: 16, animate: false })
                }
            }
        })
    }

    componentWillUnmount() {
        if (this.unsubscribeFuncs) {
            this.unsubscribeFuncs()
        }
        this.markers.removeAll()
    }

    onCreateComplete = (func) => {
        this.setState({ creating: true })
        const { firebase, onOpen } = this.props
        if (!firebase) {
            onOpen(func)
            return
        }

        const docRef = firebase.func()
        firebase
            .createFunc(docRef, func)
            .then(() => {
                window.mapWidget.map.flyTo({ center: func.coordinate.toLngLat(), zoom: Math.max(window.mapWidget.map.getZoom(), 17) })
                onOpen(docRef.id)
            })
            .catch((e) => {
                this.setState({ creating: false })
                window.notificationWidget.showSnackbar(e.message)
            })
    }

    onCreate = (e) => {
        FuncUtils.createFunc(this.onCreateComplete)
    }

    onImport = (e) => {
        if (e) {
            const reader = new FileReader()
            reader.onloadend = (e) => {
                this.onCreateComplete(Dronelink.Serialization.clone(Dronelink.Serialization.read(reader.result), true))
            }
            reader.readAsText(e.target.files[0])
            //clear out the value in case they want to cancel (so onChange will fire again)
            e.target.value = ""
        }
    }

    onLimitIncrease = () => {
        this.setState((state) => ({
            limit: state.limit + 100
        }))
    }

    onFilter = (e) => {
        this.setState({ [e.target.name]: e.target.value })
    }

    results = () => {
        const { funcs, filter } = this.state
        if (funcs) {
            return funcs.filter((func) => {
                return Utils.matchStrings(filter, [func.data().name, func.data().description].concat(func.data().tags))
            })
        }
        return null
    }

    render() {
        const { classes, onOpen } = this.props
        const { funcs, creating, filter, limit } = this.state

        const results = this.results()

        return (
            <div className={classes.container}>
                {results && (results.length > 0 || filter) && (
                    <TextField
                        name="filter"
                        autoComplete="off"
                        autoFocus={!isMobile}
                        fullWidth
                        margin="dense"
                        placeholder="Search"
                        value={filter || ""}
                        onChange={this.onFilter}
                        InputProps={{
                            startAdornment: (
                                <InputAdornment position="start">
                                    <FilterIcon color="action" />
                                </InputAdornment>
                            )
                        }}
                    />
                )}
                {!filter && (
                    <Fragment>
                        <Card className={classes.func}>
                            <CardActionArea onClick={this.onCreate}>
                                <CardContent className={classes.createContent}>
                                    <AddIcon fontSize="large" color="primary" />
                                    <Typography color="primary" variant="button">
                                        New Function
                                    </Typography>
                                </CardContent>
                            </CardActionArea>
                        </Card>
                        {!creating && (
                            <div className={classes.import}>
                                <input type="file" id="import" style={{ display: "none" }} onChange={this.onImport} />
                                <label htmlFor="import">
                                    <Button component="span" color="primary" size="small">
                                        <ImportIcon style={{ marginRight: 8 }} /> Import
                                    </Button>
                                </label>
                                <Typography variant="caption" color="textSecondary" style={{ marginLeft: 5 }}>
                                    Dronelink (lz, json)...
                                </Typography>
                            </div>
                        )}
                    </Fragment>
                )}
                {(creating || funcs === null) && <LinearProgress className={classes.progress} />}
                {results &&
                    results
                        .filter((value, index) => {
                            return index < limit
                        })
                        .map((func) => {
                            return (
                                <Card key={func.id} className={classes.func}>
                                    <CardActionArea
                                        onClick={() => {
                                            onOpen(func.id)
                                        }}
                                    >
                                        <CardHeader
                                            avatar={
                                                <Avatar className={classes.avatar}>
                                                    <FuncIcon />
                                                </Avatar>
                                            }
                                            title={func.data().name}
                                            subheader={<Moment format="lll" date={func.data().updated.toDate()} />}
                                            action={<ViewIcon color="action" className={classes.viewIcon} />}
                                        />
                                        <CardContent className={classes.content}>
                                            {func.data().description && (
                                                <div className={classes.detail}>
                                                    <Typography variant="body2">{func.data().description}</Typography>
                                                </div>
                                            )}
                                            <div className={classes.detail}>
                                                {func.data().details && (
                                                    <Fragment>
                                                        <LinesIcon className={classes.detailIcon} size="small" color="action" />
                                                        <Typography variant="body2" color="textSecondary">
                                                            {Dronelink.Format.integer(func.data().details.lines, {
                                                                singular: "Line",
                                                                plural: "Lines"
                                                            })}
                                                        </Typography>
                                                        {func.data().details.inputs > 0 && (
                                                            <Fragment>
                                                                <div className={classes.detailSpacer} />
                                                                <InputIcon className={classes.detailIcon} size="small" color="action" />
                                                                <Typography variant="body2" color="textSecondary">
                                                                    {Dronelink.Format.integer(func.data().details.inputs, {
                                                                        singular: Dronelink.Strings.FuncInput.name,
                                                                        plural: Dronelink.Strings.FuncInput.multiple
                                                                    })}
                                                                </Typography>
                                                            </Fragment>
                                                        )}
                                                    </Fragment>
                                                )}
                                            </div>
                                            {func.data().tags && (
                                                <div className={classes.detail}>
                                                    <DescriptorsTags descriptors={func.data()} />
                                                </div>
                                            )}
                                        </CardContent>
                                    </CardActionArea>
                                </Card>
                            )
                        })}
                {funcs && funcs.length === 0 && (
                    <div className={classes.empty}>
                        <EmptyIcon className={classes.emptyIcon} color="action" />
                        <Typography variant="subtitle2">
                            Functions are collections of input variables and executable code that can procedurally generate a plan. Creating functions requires a basic knowledge of JavaScript.
                        </Typography>
                    </div>
                )}
                {results && results.length > limit && (
                    <Button fullWidth color="primary" size="small" onClick={this.onLimitIncrease}>
                        Show More
                    </Button>
                )}
            </div>
        )
    }
}

const Funcs = compose(withStyles(styles), withFirebase)(FuncsBase)
export { Funcs }
