import { Link } from "react-router-dom"
import { Button } from "@/components/ui/Button"
import { Card, CardContent } from "@/components/ui/Card"
import { Home } from "lucide-react"

export default function NotFound() {
  return (
    <div className="min-h-[50vh] flex items-center justify-center px-4">
      <Card className="max-w-md w-full">
        <CardContent className="pt-6 text-center">
          <h1 className="text-6xl font-bold text-gray-300 mb-4">404</h1>
          <p className="text-xl font-semibold text-gray-900 mb-2">页面未找到</p>
          <p className="text-gray-500 mb-6">
            您访问的页面不存在或已被移动。
          </p>
          <Button asChild>
            <Link to="/">
              <Home className="w-4 h-4 mr-2" />
              返回首页
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
