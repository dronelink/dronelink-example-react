/*
 * Created by Jim McAndrew on 1/21/2020
 *
 * Copyright (c) 2020 Dronelink, LLC
 */
export default class Utils {
    static matchStrings(target, values) {
        const targets =
            target &&
            target
                .toLowerCase()
                .split(",")
                .map(target => {
                    return target.trim()
                })
                .filter(target => {
                    return !!target
                })

        if (!targets || targets.length === 0) {
            return true
        }

        values = values.map(value => {
            return value ? value.toLowerCase() : null
        })

        return (
            targets.filter(target => {
                for (const value of values) {
                    if (value && value.toLowerCase().includes(target)) {
                        return true
                    }
                }
                return false
            }).length === targets.length
        )
    }
}
