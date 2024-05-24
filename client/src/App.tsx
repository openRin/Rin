import { Route, Switch } from 'wouter'
import { Header } from './components/header'
import { Feeds } from './page/feeds'
import { CallbackPage } from './page/callback'
import { WritingPage } from './page/writing'
import { FeedPage } from './page/feed'
import { Profile, ProfileContext } from './state/profile'
import { useEffect, useRef, useState } from 'react'
import { client } from './main'
import { headersWithAuth } from './utils/auth'

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
          <Route path="/">
            <Header />
            <div className="mx-32 mt-8">
              <Feeds />
            </div>
          </Route>

          <Route path="/feed/:id">
            {params =>
              <>
                <Header />
                <div className="mx-32 mt-8">
                  <FeedPage id={params.id} />
                </div>
              </>
            }
          </Route>

          <Route path="/about">
            <Header />
            <div className="mx-32 mt-8">
              About
            </div>
          </Route>

          <Route path="/writing">
            <Header />
            <WritingPage />
          </Route>

          <Route path="/writing/:id">
            {({ id }) => <>
              <Header />
              <WritingPage id={id} />
            </>
            }
          </Route>

          <Route path="/callback" component={CallbackPage} />

          {/* Default route in a switch */}
          <Route>404: No such page!</Route>
        </Switch>
      </ProfileContext.Provider>
    </>
  )
}

export default App
