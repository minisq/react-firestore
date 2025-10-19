import React, { useCallback, useEffect, useState } from "react"
import { DocumentReference, getDoc, getDocs, Query, setDoc } from "firebase/firestore"

// Doc

type DocParams<T> = {
    docRef: DocumentReference<T>
    children: (args: { data: T | undefined; loading: boolean }) => React.ReactNode
}

export const Doc = <T>({ docRef, children }: DocParams<T>) => {
    const [data, setData] = useState<T | undefined>(undefined)
    const [loading, setLoading] = useState<boolean>(true)

    useEffect(() => {
        let active = true
        setLoading(true)

        getDoc(docRef)
            .then((result) => {
                if (active) setData(result.data())
            })
            .catch((error) => {
                console.error(error)
            })
            .finally(() => {
                if (active) setLoading(false)
            })

        return () => {
            active = false
        }
    }, [docRef])

    return children({ data, loading })
}

// Docs

type TWithId<T> = T & { id: string }

type DocsParams<T> = {
    query: Query<T>
    children: (args: { data: TWithId<T>[]; loading: boolean }) => React.ReactNode
}

export const Docs = <T>({ query, children }: DocsParams<T>) => {
    const [data, setData] = useState<TWithId<T>[]>([])
    const [loading, setLoading] = useState<boolean>(true)

    useEffect(() => {
        let active = true
        setLoading(true)

        getDocs(query)
            .then((result) => {
                if (active) setData(result.docs.map((doc) => ({ ...doc.data(), id: doc.id })))
            })
            .catch((error) => {
                console.error(error)
            })
            .finally(() => {
                if (active) setLoading(false)
            })

        return () => {
            active = false
        }
    }, [query])

    return children({ data, loading })
}

// Form

type Primitive = string | number | boolean | bigint | symbol | null | undefined | Date | Function

type Path<T> = T extends Primitive
    ? never
    : {
          [K in keyof T & string]: NonNullable<T[K]> extends Primitive ? K : K | `${K}.${Path<NonNullable<T[K]>>}`
      }[keyof T & string]

type PathValue<T, P extends string> = P extends `${infer K}.${infer R}`
    ? K extends keyof T
        ? PathValue<NonNullable<T[K]>, R>
        : never
    : P extends keyof T
    ? NonNullable<T[P]>
    : never

const updateObject = <T, P extends Path<T>>(obj: T, path: P, value: PathValue<T, P>) => {
    const keys = (path as string).split(".")
    const clone: any = Array.isArray(obj) ? [...(obj as any)] : { ...(obj as any) }
    let cur: any = clone
    for (let i = 0; i < keys.length - 1; i++) {
        const k = keys[i]!
        const next = cur[k]
        cur[k] = next == null ? {} : Array.isArray(next) ? [...next] : { ...next }
        cur = cur[k]
    }
    cur[keys[keys.length - 1]!] = value
    return clone as T
}

type FormParams<T> = {
    docRef: DocumentReference<T>
    children: (args: {
        data: T | undefined
        loading: boolean
        saving: boolean
        update: <P extends Path<T>>(path: P, value: PathValue<T, P>) => void
        save: () => void | Promise<void>
    }) => React.ReactNode
}

export const Form = <T>({ docRef, children }: FormParams<T>) => {
    const [data, setData] = useState<T | undefined>(undefined)
    const [loading, setLoading] = useState<boolean>(true)
    const [saving, setSaving] = useState<boolean>(false)

    useEffect(() => {
        let active = true
        setLoading(true)

        getDoc(docRef)
            .then((result) => {
                if (active) setData(result.data())
            })
            .catch((error) => {
                console.error(error)
            })
            .finally(() => {
                if (active) setLoading(false)
            })

        return () => {
            active = false
        }
    }, [docRef])

    const update = useCallback(<P extends Path<T>>(path: P, value: PathValue<T, P>) => {
        setData((prev) => {
            const next: any = { ...(prev ?? {}) }
            const keys = path.split(".")
            let cur = next

            for (let i = 0; i < keys.length - 1; i++) {
                const k = keys[i]!
                if (typeof cur[k] !== "object" || cur[k] === null) cur[k] = {}
                else cur[k] = Array.isArray(cur[k]) ? [...cur[k]] : { ...cur[k] }
                cur = cur[k]
            }

            cur[keys[keys.length - 1]!] = value
            return next
        })
    }, [])

    const save = useCallback(async () => {
        if (data == null) return
        setSaving(true)

        try {
            await setDoc(docRef, data)
        } catch (error) {
            console.error(error)
        } finally {
            setSaving(false)
        }
    }, [docRef, data])

    return children({ data, loading, saving, update, save })
}
