/*
 * Created by Jim McAndrew on 5/20/2019
 *
 * Copyright (c) 2019 Dronelink, LLC
 */
import React, { Component, Fragment } from "react"
import { compose } from "recompose"
import { withStyles } from "@material-ui/core/styles"
import { Button, Avatar, Typography, Card, CardActionArea, CardHeader, CardContent, TextField, InputAdornment, LinearProgress } from "@material-ui/core"
import { Search as FilterIcon } from "@material-ui/icons"
import * as Dronelink from "dronelink-kernel"
import Moment from "react-moment"
import { ComponentUtils, DescriptorsTags } from "react-dronelink"
import { withFirebase } from "../../components/firebase"
import { isMobile } from "react-device-detect"
import Utils from "../../components/utils"

const styles = theme => ({
    filter: {
        paddingLeft: theme.spacing(2),
        paddingRight: theme.spacing(2)
    },
    component: {
        padding: 0,
        marginBottom: theme.spacing(2),
        width: "100%"
    },
    header: {
        paddingBottom: theme.spacing(1.5)
    },
    content: {
        paddingTop: 0,
        paddingBottom: theme.spacing(1)
    },
    detail: {
        marginTop: theme.spacing(1),
        marginBottom: theme.spacing(1),
        display: "flex",
        alignItems: "center"
    },
    actions: {
        padding: theme.spacing(1.5)
    },
    results: {
        padding: theme.spacing(2),
        overflowY: "auto",
        "-webkit-overflow-scrolling": "touch"
    },
    progress: {
        width: "100%",
        minWidth: 200
    },
    empty: {
        maxWidth: 300,
        display: "flex",
        flexDirection: "row",
        alignItems: "flex-start",
        marginRight: theme.spacing(1),
        marginBottom: theme.spacing(2)
    },
    emptyIcon: {
        marginRight: theme.spacing(1)
    }
})

class ComponentSelect extends Component {
    state = {
        components: null,
        filter: null,
        limit: 10
    }

    componentDidMount() {
        this.unsubscribeComponents = this.props.firebase.components(Dronelink.TypeName.SubComponent).onSnapshot(snapshot => {
            if (this.unmounted || snapshot.metadata.hasPendingWrites) {
                return
            }

            const { excludeComponentID } = this.props
            this.setState({
                components: snapshot.docs.filter(doc => {
                    if (!excludeComponentID) {
                        return true
                    }

                    return doc.id !== excludeComponentID
                })
            })
        })
    }

    componentWillUnmount() {
        this.unmounted = true
        if (this.unsubscribeComponents) {
            this.unsubscribeComponents()
        }
    }

    onLimitIncrease = () => {
        this.setState(state => ({
            limit: state.limit + 10
        }))
    }

    onFilter = e => {
        this.setState({ [e.target.name]: e.target.value })
    }

    results = () => {
        const { filter, components } = this.state
        if (!components) {
            return null
        }

        const results = components.filter(component => {
            return Utils.matchStrings(filter, [Dronelink.Serialization.typeDisplay(component.data().type), component.data().name, component.data().description].concat(component.data().tags))
        })

        return results.sort((a, b) => {
            return (
                b
                    .data()
                    .updated.toDate()
                    .getTime() -
                a
                    .data()
                    .updated.toDate()
                    .getTime()
            )
        })
    }

    render() {
        const { filter, limit } = this.state
        const { classes, onSelect } = this.props
        const results = this.results()
        return (
            <Fragment>
                {results && (results.length > 0 || filter) && (
                    <TextField
                        name="filter"
                        autoComplete="off"
                        autoFocus={!isMobile}
                        fullWidth
                        margin="dense"
                        className={classes.filter}
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
                <div className={classes.results}>
                    {!results && <LinearProgress className={classes.progress} />}
                    {results &&
                        results
                            .filter((value, index) => {
                                return index < limit
                            })
                            .map(component => {
                                return (
                                    <Card key={component.id} className={classes.component}>
                                        <CardActionArea
                                            onClick={() => {
                                                onSelect(component)
                                            }}
                                        >
                                            <CardHeader
                                                className={classes.header}
                                                avatar={<Avatar>{ComponentUtils.getIcon(component.data().type)}</Avatar>}
                                                title={component.data().name}
                                                subheader={<Moment format="MMM D, YYYY" date={component.data().updated.toDate()} />}
                                            />
                                            {(component.data().description || (component.data().tags && component.data().tags.length > 0)) && (
                                                <CardContent className={classes.content}>
                                                    {component.data().description && (
                                                        <div className={classes.detail}>
                                                            <Typography variant="body2" color="textSecondary">
                                                                {component.data().description}
                                                            </Typography>
                                                        </div>
                                                    )}
                                                    {component.data().tags && component.data().tags.length > 0 && (
                                                        <div className={classes.detail}>
                                                            <DescriptorsTags descriptors={component.data()} />
                                                        </div>
                                                    )}
                                                </CardContent>
                                            )}
                                        </CardActionArea>
                                    </Card>
                                )
                            })}
                    {results && results.length > limit && (
                        <Button fullWidth color="primary" size="small" onClick={this.onLimitIncrease}>
                            Show More
                        </Button>
                    )}
                    {results && results.length === 0 && (
                        <div className={classes.empty}>
                            <Typography variant="subtitle2">No Components</Typography>
                        </div>
                    )}
                </div>
            </Fragment>
        )
    }
}

export default compose(withStyles(styles), withFirebase)(ComponentSelect)
