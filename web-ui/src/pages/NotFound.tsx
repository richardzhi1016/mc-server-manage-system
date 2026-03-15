import { Link } from "react-router-dom"
import { Button } from "@/components/ui/Button"
import { Card, CardContent } from "@/components/ui/Card"
import { Home } from "lucide-react"
import { useTranslation } from "react-i18next"

export default function NotFound() {
  const { t } = useTranslation('common')
  return (
    <div className="min-h-[50vh] flex items-center justify-center px-4">
      <Card className="max-w-md w-full">
        <CardContent className="pt-6 text-center">
          <h1 className="text-6xl font-bold text-gray-300 mb-4">404</h1>
          <p className="text-xl font-semibold text-gray-900 mb-2">{t('notFound.title')}</p>
          <p className="text-gray-500 mb-6">
            {t('notFound.desc')}
          </p>
          <Button asChild>
            <Link to="/">
              <Home className="w-4 h-4 mr-2" />
              {t('notFound.back')}
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
