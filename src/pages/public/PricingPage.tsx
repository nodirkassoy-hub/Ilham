import { Link } from 'react-router-dom'
import { PricingSection } from './PricingSection'
import { useT } from '@/core/i18n'
import { Button } from '@/ui/primitives'

export default function PricingPage() {
  const t = useT()
  return (
    <div className="relative pt-20">
      <div className="aurora" />
      <div className="grid-bg absolute inset-x-0 top-0 h-[600px]" />
      <div className="relative">
        <PricingSection showCompare />
        <section className="pb-24">
          <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
            <h2 className="text-2xl font-bold sm:text-3xl">{t('landing.trial.title')}</h2>
            <p className="mt-3 text-muted">{t('landing.trial.sub')}</p>
            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <Link to="/register">
                <Button size="lg">{t('landing.cta.start')}</Button>
              </Link>
              <Link to="/login?demo=1">
                <Button size="lg" variant="outline">
                  {t('landing.cta.watchDemo')}
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
