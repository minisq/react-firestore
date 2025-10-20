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

type Primitive = string | number | boolean | null | undefined | Date

type Clean<T> = NonNullable<T>

export type Path<T> = T extends Primitive
    ? never
    : {
          [K in keyof T & string]: Clean<T[K]> extends Primitive
              ? K
              : Clean<T[K]> extends (infer U)[]
              ? K | `${K}.${number}` | `${K}.${number}.${Path<U>}`
              : K | `${K}.${Path<Clean<T[K]>>}`
      }[keyof T & string]

export type PathValue<T, P extends string> = P extends `${infer K}.${infer Rest}`
    ? K extends keyof T
        ? Clean<T[K]> extends (infer U)[]
            ? Rest extends `${number}.${infer Tail}`
                ? PathValue<U, Tail>
                : Rest extends `${number}`
                ? U
                : never
            : PathValue<Clean<T[K]>, Rest>
        : never
    : P extends keyof T
    ? T[P]
    : never

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

    const update = React.useCallback(<P extends Path<T>>(path: P, value: PathValue<T, P>) => {
        setData((prev) => {
            const root: any = Array.isArray(prev) ? [...(prev as any[])] : { ...(prev ?? {}) }

            // "a.b.2.c" -> ["a","b",2,"c"]
            const segments = String(path)
                .split(".")
                .map((s) => {
                    const n = Number(s)
                    return Number.isInteger(n) && s.trim() !== "" ? n : s
                })

            let cur: any = root
            for (let i = 0; i < segments.length - 1; i++) {
                const seg = segments[i]!
                const nextSeg = segments[i + 1]!

                if (typeof seg === "number") {
                    // ensure array at this level
                    if (!Array.isArray(cur)) throw new Error(`Expected array at segment ${seg}`)
                    const existing = cur[seg]
                    const emptyChild = typeof nextSeg === "number" ? [] : {}
                    cur[seg] =
                        existing == null ? emptyChild : Array.isArray(existing) ? [...existing] : typeof existing === "object" ? { ...existing } : emptyChild
                    cur = cur[seg]
                } else {
                    const existing = cur[seg]
                    const emptyChild = typeof nextSeg === "number" ? [] : {}
                    cur[seg] =
                        existing == null ? emptyChild : Array.isArray(existing) ? [...existing] : typeof existing === "object" ? { ...existing } : emptyChild
                    cur = cur[seg]
                }
            }

            const leaf = segments[segments.length - 1]!
            if (typeof leaf === "number") {
                if (!Array.isArray(cur)) throw new Error(`Expected array at final segment ${leaf}`)
                const clone = [...cur]
                clone[leaf] = value as unknown
                // assign back to parent (cur is a ref to the array we cloned)
                // find where this array sits and replace; easiest is mutate in place:
                cur.length = 0
                clone.forEach((x) => cur.push(x))
            } else {
                cur[leaf] = value as unknown
            }

            return root
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
