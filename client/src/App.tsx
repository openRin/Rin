import { Route, Switch } from 'wouter'
import { Header } from './components/header'
import { Feeds } from './page/feeds'
import { CallbackPage } from './page/callback'
import { WritingPage } from './page/writing'

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

          <Route path="/about">
            <Header />
            <div className="mx-32 mt-8">
              About
            </div>
          </Route>

          <Route path="/writing">
            <Header />
            <div className="mx-32 mt-8">
              <WritingPage />
            </div>
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
