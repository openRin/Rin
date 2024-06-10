import { useEffect, useRef, useState } from 'react'
import { getCookie } from 'typescript-cookie'
import { DefaultParams, PathPattern, Route, RouteProps, Switch } from 'wouter'
import Footer from './components/footer'
import { Header } from './components/header'
import { Padding } from './components/padding'
import { client } from './main'
import { CallbackPage } from './page/callback'
import { FeedPage, TOCHeader } from './page/feed'
import { FeedsPage } from './page/feeds'
import { FriendsPage } from './page/friends'
import { TimelinePage } from './page/timeline'
import { WritingPage } from './page/writing'
import { Profile, ProfileContext } from './state/profile'
import { headersWithAuth } from './utils/auth'
function App() {
  const ref = useRef(false)
  const [profile, setProfile] = useState<Profile | undefined>()
  useEffect(() => {
    if (ref.current) return
    if (getCookie('token')?.length ?? 0 > 0) {
      client.user.profile.get({
        headers: headersWithAuth()
      }).then(({ data }) => {
        if (data && typeof data != 'string') {
          setProfile({
            id: data.id,
            avatar: data.avatar || '',
            permission: data.permission,
            name: data.username
          })
        }
      })
    }
    ref.current = true
  }, [])
  return (
    <>
      <ProfileContext.Provider value={profile}>
        <Switch>
          <RouteMe path="/">
            <FeedsPage />
          </RouteMe>

          <RouteMe path="/timeline">
            <TimelinePage />
          </RouteMe>


          <RouteMe path="/writing">
            <WritingPage />
          </RouteMe>
          <RouteMe path="/friends">
            <FriendsPage />
          </RouteMe>

          <RouteMe path="/writing/:id">
            {({ id }) => {
              const id_num = parseInt(id)
              return (
                <WritingPage id={id_num} />
              )
            }
            }
          </RouteMe>

          <RouteMe path="/callback" >
            <CallbackPage />
          </RouteMe>

          <Route path="/feed/:id" >
            {params => {
              return (<>
                <Header>
                  <TOCHeader />
                </Header>
                <Padding className='mx-4'>
                  <FeedPage id={params.id} />
                </Padding>
                <Footer />
              </>)
            }}
          </Route>

          <Route path="/:alias">
            {params => {
              return (<>
                <Header>
                  <TOCHeader />
                </Header>
                <Padding className='mx-4'>
                  <FeedPage id={params.alias} />
                </Padding>
                <Footer />
              </>)
            }}
          </Route>

          {/* Default route in a switch */}
          <Route>404: No such page!</Route>
        </Switch>
      </ProfileContext.Provider>
    </>
  )
}

function RouteMe<
  T extends DefaultParams | undefined = undefined,
  RoutePath extends PathPattern = PathPattern
>(props: RouteProps<T, RoutePath>) {
  const { children, ...rest } = props
  return (
    <Route {...rest} >
      {params => {
        return (<>
          <Header />
          <Padding>
            {typeof children === 'function' ? children(params) : children}
          </Padding>
          <Footer />
        </>)
      }}
    </Route>
  )
}
export default App
