import { useEffect, useRef, useState } from 'react'
import { Route, Switch } from 'wouter'
import { Header } from './components/header'
import { client } from './main'
import { CallbackPage } from './page/callback'
import { FeedPage } from './page/feed'
import { FeedsPage } from './page/feeds'
import { WritingPage } from './page/writing'
import { Profile, ProfileContext } from './state/profile'
import { headersWithAuth } from './utils/auth'
import { FriendsPage } from './page/friends'
function App() {
  const ref = useRef(false)
  const [profile, setProfile] = useState<Profile | undefined>()
  useEffect(() => {
    if (ref.current) return
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
    ref.current = true
  }, [])
  return (
    <>
      <ProfileContext.Provider value={profile}>
        <Switch>
          <Route path="/" component={FeedsPage} />

          <Route path="/feed/:id">
            {params => <FeedPage id={params.id} />}
          </Route>

          <Route path="/writing">
            <Header />
            <WritingPage />
          </Route>
          <Route path="/friends">
            <FriendsPage />
          </Route>

          <Route path="/writing/:id">
            {({ id }) => <>
              <Header />
              <WritingPage idOrAlias={id} />
            </>
            }
          </Route>

          <Route path="/callback" component={CallbackPage} />

          <Route path="/:alias">
            {params => <FeedPage id={params.alias} />}
          </Route>

          {/* Default route in a switch */}
          <Route>404: No such page!</Route>
        </Switch>
      </ProfileContext.Provider>
    </>
  )
}

export default App
