import { Link, NonIndexRouteObject, RouteMatch, useLocation, useNavigate, useRoutes } from "react-router-dom"
import { Fragment, JSXElementConstructor, ReactElement, useEffect, useMemo, useRef, useState } from "react"
import { MenuFoldOutlined, MenuUnfoldOutlined } from "@ant-design/icons"
import { isNil, reduce, last, filter, not, isEmpty } from "ramda"
import { usePageContext } from "@/providers/PageManageProvider"
import { SuspenseLoading } from "@/components/Loading"
import { Button, Layout as ALayout, Menu, Tabs } from "antd"
import type { ItemType } from "antd/lib/menu/hooks/useItems"
import KeepAlive, { KeepAliveRef } from "@/components/KeepAlive"

import { RouteConfig } from "@/router/config"
import { hasAllAuth, hasAnyAuth } from "@/utils/auth.ts"

function mergePath(path: string, paterPath = "") {
    path = path.startsWith("/") ? path : "/" + path
    return paterPath + path
}

function checkAuthPass(route: RouteConfig) {
    if (isNil(route.authority) || isEmpty(route.authority)) {
        return true
    }
    const type = isNil(route.authorityType) ? "all" : route.authorityType
    const authority = route.authority
    if (type === "all") {
        return hasAllAuth(authority)
    } else {
        return hasAnyAuth(authority)
    }
}

// 渲染导航栏
function renderMenu(data: Array<RouteConfig>, path?: string) {
    return reduce(
        (items, route) => {
            // 不在菜单显示
            if (route.notMenu) {
                return items
            }
            // 权限验证 不通过不显示
            if (!checkAuthPass(route)) {
                return items
            }
            const thisPath = mergePath(route.path, path)
            const children = filter(route => not(route.notMenu), route.children ?? [])
            const hasChildren = isNil(children) || isEmpty(children)
            items.push({
                key: route.name,
                title: route.meta?.title,
                icon: route.icon,
                label: !hasChildren ? (
                    <span className="a-black">{route.meta?.title}</span>
                ) : (
                    <Link to={thisPath} className="a-black">
                        {route.meta?.title}
                    </Link>
                ),
                children: hasChildren ? undefined : renderMenu(children, thisPath),
            })
            return items
        },
        [] as ItemType[],
        data,
    )
}

function getRouteContext(data: any): any {
    if (isNil(data.children)) {
        return null
    }
    return isNil(data.routeContext) ? getRouteContext(data.children.props) : data.routeContext
}

function getLatchRouteByEle(ele: ReactElement): RouteMatch[] | null {
    if (ele) {
        const data = getRouteContext(ele.props)
        return isNil(data?.outlet) ? (data?.matches as RouteMatch[]) : getLatchRouteByEle(data?.outlet)
    }
    return null
}

function getMatchRouteObj(ele: ReactElement | null) {
    if (isNil(ele)) {
        return null
    }
    const matchRoutes = getLatchRouteByEle(ele)
    if (isNil(matchRoutes)) {
        return null
    }
    const selectedKeys: string[] = reduce(
        (selectedKeys: string[], res) => {
            const route = res.route as RouteObjectDto
            if (route.name) {
                selectedKeys.push(route.name)
            }
            return selectedKeys
        },
        [],
        matchRoutes,
    )
    const matchRoute = last(matchRoutes)
    const data = matchRoute?.route as RouteObjectDto
    return {
        key: data.layout ? matchRoute?.pathnameBase ?? "" : matchRoute?.pathname ?? "",
        title: data?.meta?.title ?? "",
        name: data?.name ?? "",
        selectedKeys,
        cache: data.cache,
    }
}

export interface RouteObjectDto extends NonIndexRouteObject {
    name: string
    meta?: { title: string }
    cache: boolean
    layout?: boolean // 嵌套二次自定义布局
}

function makeRouteObject(routes: RouteConfig[], upperPath?: string): Array<RouteObjectDto> {
    const RouteObjectDtoList: Array<RouteObjectDto> = []
    for (let i = 0; i < routes.length; i++) {
        const route = routes[i]
        const fullPath = mergePath(route.path, upperPath)
        const cache = isNil(route.cache) ? false : route.cache
        // 检查权限 不通过不渲染
        if (!checkAuthPass(route)) {
            continue
        }
        const routeObjectDto: RouteObjectDto = {
            path: route.path,
            name: route.name,
            meta: route.meta,
            cache,
            element: <route.component meta={route.meta} />,
            children: isNil(route.children) ? undefined : makeRouteObject(route.children, fullPath),
        }
        RouteObjectDtoList.push(routeObjectDto)
    }
    return RouteObjectDtoList
}

interface Props {
    route: RouteConfig
}

function Layout({ route }: Props) {
    const eleRef = useRef<ReactElement<any, string | JSXElementConstructor<any>> | null>()
    const keepAliveRef = useRef<KeepAliveRef>(null)
    const location = useLocation()
    const navigate = useNavigate()
    const { pages, active, open, close } = usePageContext()

    const [routes, items] = useMemo(() => {
        if (isNil(route.children)) {
            return [[], []] as [RouteObjectDto[], ItemType[]]
        }
        return [makeRouteObject(route.children), renderMenu(route.children)]
    }, [route])

    // 匹配 当前路径要渲染的路由
    const ele = useRoutes(routes, location)

    const matchRouteObj = useMemo(() => {
        eleRef.current = ele
        return getMatchRouteObj(ele)
    }, [routes, location])

    useEffect(() => {
        const { key, title, cache } = matchRouteObj ?? {}
        if (!isNil(key)) {
            const fullPath = location.pathname + location.search
            open({
                // 没有缓存的路由，不需要打开多个tab
                key: cache ? fullPath : key,
                label: title as string,
                cache,
            })
        }
    }, [matchRouteObj, location])

    const activeKey = useMemo(() => {
        return location.pathname + location.search
    }, [location])

    const [collapsed, setCollapsed] = useState(false)

    return (
        <ALayout className={"w-full h-screen"}>
            <ALayout>
                <ALayout.Sider collapsed={collapsed} width={220} theme="light">
                    <div
                        className={
                            "px-[10px] w-full whitespace-nowrap overflow-hidden text-[#1C80FF] text-[20px] pb-0 py-[10px] font-semibold text-center"
                        }
                    >
                        {collapsed ? "S" : "Super Admin"}
                    </div>
                    <Menu
                        style={{
                            padding: "10px 10px",
                        }}
                        selectedKeys={matchRouteObj?.selectedKeys}
                        defaultOpenKeys={matchRouteObj?.selectedKeys}
                        items={items}
                        mode={"inline"}
                    />
                </ALayout.Sider>
                <ALayout
                    style={{
                        background: "#F0F2F5",
                    }}
                >
                    <ALayout.Header
                        style={{
                            height: 50,
                            background: "#fff",
                            display: "flex",
                            padding: "0 10px",
                            alignItems: "center",
                            justifyContent: "space-between",
                        }}
                        className="app-header"
                    >
                        <div className={"header-left"}>
                            <Button
                                onClick={() => {
                                    setCollapsed(!collapsed)
                                }}
                                type={"link"}
                                icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
                            ></Button>
                        </div>
                    </ALayout.Header>
                    <Tabs
                        className="app-tabs"
                        style={{
                            margin: 5,
                        }}
                        size={"small"}
                        hideAdd
                        type="editable-card"
                        onChange={key => {
                            navigate({
                                pathname: key,
                            })
                        }}
                        onEdit={(targetKey, action) => {
                            if (action === "remove") {
                                const willOpenKey = close(targetKey as string, () => {
                                    keepAliveRef?.current?.removeCache(targetKey as string)
                                })
                                if (willOpenKey) {
                                    navigate({
                                        pathname: willOpenKey,
                                    })
                                }
                            }
                        }}
                        activeKey={active}
                        items={pages}
                    />
                    <ALayout.Content className="app-content px-[5px]">
                        <Fragment>
                            <SuspenseLoading>
                                <KeepAlive
                                    aliveRef={keepAliveRef}
                                    activeName={matchRouteObj?.cache ? activeKey : undefined}
                                    maxLen={20}
                                >
                                    {matchRouteObj?.cache ? eleRef.current : null}
                                </KeepAlive>
                                {matchRouteObj?.cache ? null : (
                                    <div className={"page-content page-content-animate"}>{eleRef.current}</div>
                                )}
                            </SuspenseLoading>
                        </Fragment>
                    </ALayout.Content>
                </ALayout>
            </ALayout>
        </ALayout>
    )
}

export default Layout
