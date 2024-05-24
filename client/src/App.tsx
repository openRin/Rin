import { Route, Switch } from 'wouter'
import { Header } from './components/header'
import { Feeds } from './page/feeds'
import { CallbackPage } from './page/callback'
import { WritingPage } from './page/writing'
import { FeedPage } from './page/feed'

function App() {
  return (
    <>
      <>
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
      </>
    </>
  )
}

export default App
