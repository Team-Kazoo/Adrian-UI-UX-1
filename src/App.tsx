import './App.css'
import { Button } from '@/components/ui/button'

function App() {
  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
        <div className="container mx-auto px-4 py-8">
          <h1 className="text-4xl font-bold text-white text-center mb-8">
            Kazoo Proto Web - React Migration
          </h1>
          <div className="bg-white/10 backdrop-blur-md rounded-lg p-8 text-white">
            <p className="text-xl mb-4">
              Phase 0 Complete: Vite + React + TypeScript + Tailwind CSS v4
            </p>
            <div className="flex gap-4 flex-wrap">
              <Button variant="default">Default Button</Button>
              <Button variant="secondary">Secondary Button</Button>
              <Button variant="outline">Outline Button</Button>
              <Button variant="destructive">Destructive Button</Button>
            </div>
            <p className="text-sm mt-4 text-green-300">
              ✅ shadcn/ui integration working!
            </p>
          </div>
        </div>
      </div>
    </>
  )
}

export default App
