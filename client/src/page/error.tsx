import { useTranslation } from 'react-i18next'
import { Button } from '../components/button'
import { Helmet } from 'react-helmet'
import { siteName } from '../utils/constants'

export function ErrorPage({error}: {error?: string}) {
    const { t } = useTranslation()
    return (
        <>
            <Helmet>
                <title>{`${t('error.title')} - ${process.env.NAME}`}</title>
                <meta property="og:site_name" content={siteName} />
                <meta property="og:title" content={t('error.title')} />
                <meta property="og:image" content={process.env.AVATAR} />
            </Helmet>
            <div className="w-full flex flex-row justify-center ani-show">
                    <div className="flex flex-col wauto rounded-2xl bg-w m-2 p-6 items-center justify-center space-y-2">
                    <h1 className="text-xl font-bold t-primary">{error}</h1>
                    <Button
                        title={t("index.back")}
                        onClick={() => (window.location.href = "/")}
                    />
                </div>
            </div>
        </>
    );
}
