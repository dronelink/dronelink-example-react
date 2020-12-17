/*
 * Created by Jim McAndrew on 11/6/2020
 *
 * Copyright (c) 2020 Dronelink, LLC
 */
import React, { Component, Fragment } from "react"
import { compose } from "recompose"
import Moment from "react-moment"
import { withStyles } from "@material-ui/core/styles"
import { TextField, InputAdornment, Button, Typography, Card, CardContent, CardActionArea, CardHeader, Avatar, LinearProgress } from "@material-ui/core"
import { Search as FilterIcon, Add as AddIcon, KeyboardArrowRight as ViewIcon, CloudUpload as ImportIcon } from "@material-ui/icons"
import { AnimationPlayOutline as ModeIcon, LanguageJavascript as LinesIcon, LightbulbOnOutline as EmptyIcon } from "mdi-material-ui"
import ModePinImage from "../../assets/img/mode-pin.png"
import { ModeUtils, MapUtils, MapMarkerCollection } from "react-dronelink"
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
    mode: {
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
    modeMarker: MapUtils.markerCSSPin(ModePinImage),
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

class ModesBase extends Component {
    state = {
        modes: null,
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
                modes: false
            })
            return
        }

        this.unsubscribeModes = firebase.modes().onSnapshot((snapshot) => {
            if (snapshot.metadata.hasPendingWrites) {
                return
            }

            const modes = Firebase.sortDocsByDate(snapshot.docs, "touched")

            this.markers.refresh(
                modes.length,
                (index) => {
                    const mode = modes[index]
                    const marker = MapUtils.elementMarkerPin(
                        classes.modeMarker,
                        false,
                        null,
                        () => {
                            window.mapWidget.onHoverMarker()
                            this.props.onOpen(mode.id)
                        },
                        (e) => {
                            window.mapWidget.onHoverMarker(e, () => {
                                return mode.data().name
                            })
                        }
                    )
                    marker.setLngLat([mode.data().coordinate.longitude, mode.data().coordinate.latitude])
                    return marker
                },
                (marker, index) => {
                    const mode = modes[index]
                    marker.setLngLat([mode.data().coordinate.longitude, mode.data().coordinate.latitude])
                }
            )

            this.setState({
                modes: modes
            })

            if (modes.length > 0) {
                const bounds = new mapboxgl.LngLatBounds()
                modes.forEach((mode) => {
                    bounds.extend([mode.data().coordinate.longitude, mode.data().coordinate.latitude])
                })
                window.mapWidget.map.fitBounds(bounds, { padding: { top: 125, left: 425, right: 50, bottom: 50 }, maxZoom: 16, animate: false })
            }
        })
    }

    componentWillUnmount() {
        if (this.unsubscribeModes) {
            this.unsubscribeModes()
        }
        this.markers.removeAll()
    }

    onCreateComplete = (mode) => {
        this.setState({ creating: true })
        const { firebase, onOpen } = this.props
        if (!firebase) {
            onOpen(mode)
            return
        }

        const docRef = firebase.mode()
        firebase
            .createMode(docRef, mode)
            .then(() => {
                window.mapWidget.map.flyTo({ center: mode.coordinate.toLngLat(), zoom: Math.max(window.mapWidget.map.getZoom(), 17) })
                onOpen(docRef.id)
            })
            .catch((e) => {
                this.setState({ creating: false })
                window.notificationWidget.showSnackbar(e.message)
            })
    }

    onCreate = (e) => {
        ModeUtils.createMode(this.onCreateComplete)
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
        const { modes, filter } = this.state
        if (modes) {
            return modes.filter((mode) => {
                return Utils.matchStrings(filter, [mode.data().name, mode.data().description].concat(mode.data().tags))
            })
        }
        return null
    }

    render() {
        const { classes, onOpen } = this.props
        const { modes, creating, filter, limit } = this.state

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
                        <Card className={classes.mode}>
                            <CardActionArea onClick={this.onCreate}>
                                <CardContent className={classes.createContent}>
                                    <AddIcon fontSize="large" color="primary" />
                                    <Typography color="primary" variant="button">
                                        New Mode
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
                {(creating || modes === null) && <LinearProgress className={classes.progress} />}
                {results &&
                    results
                        .filter((value, index) => {
                            return index < limit
                        })
                        .map((mode) => {
                            return (
                                <Card key={mode.id} className={classes.mode}>
                                    <CardActionArea
                                        onClick={() => {
                                            onOpen(mode.id)
                                        }}
                                    >
                                        <CardHeader
                                            avatar={
                                                <Avatar className={classes.avatar}>
                                                    <ModeIcon />
                                                </Avatar>
                                            }
                                            title={mode.data().name}
                                            subheader={<Moment format="lll" date={mode.data().updated.toDate()} />}
                                            action={<ViewIcon color="action" className={classes.viewIcon} />}
                                        />
                                        <CardContent className={classes.content}>
                                            {mode.data().description && (
                                                <div className={classes.detail}>
                                                    <Typography variant="body2">{mode.data().description}</Typography>
                                                </div>
                                            )}
                                            <div className={classes.detail}>
                                                {mode.data().details && (
                                                    <Fragment>
                                                        <LinesIcon className={classes.detailIcon} size="small" color="action" />
                                                        <Typography variant="body2" color="textSecondary">
                                                            {Dronelink.Format.integer(mode.data().details.lines, {
                                                                singular: "Line",
                                                                plural: "Lines"
                                                            })}
                                                        </Typography>
                                                    </Fragment>
                                                )}
                                            </div>
                                            {mode.data().tags && (
                                                <div className={classes.detail}>
                                                    <DescriptorsTags descriptors={mode.data()} />
                                                </div>
                                            )}
                                        </CardContent>
                                    </CardActionArea>
                                </Card>
                            )
                        })}
                {modes && modes.length === 0 && (
                    <div className={classes.empty}>
                        <EmptyIcon className={classes.emptyIcon} color="action" />
                        <Typography variant="subtitle2">A mode is executable code that can perform real-time flight control. Creating modes requires basic knowledge of JavaScript.</Typography>
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

const Modes = compose(withStyles(styles), withFirebase)(ModesBase)
export { Modes }
