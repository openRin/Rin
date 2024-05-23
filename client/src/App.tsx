import { Header } from './components/header'
import { Feeds } from './page/feeds'

function App() {
  return (
    <>
      <Header />
      <div className="mx-32 mt-8">
        <Feeds />
      </div>
    </>
  )
}

export default App
