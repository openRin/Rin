import { Helmet } from "react-helmet";
import { useSiteConfig } from "../hooks/useSiteConfig";

interface SiteMetaProps {
    title?: string;
    description?: string;
    image?: string;
    children: React.ReactNode;
}

// Component to provide site metadata for pages
export function SiteMeta({ title, description, image, children }: SiteMetaProps) {
    const siteConfig = useSiteConfig();

    const pageTitle = title 
        ? `${title} - ${siteConfig.name}` 
        : siteConfig.name;

    const pageDescription = description || siteConfig.description;
    const pageImage = image || siteConfig.avatar;

    return (
        <>
            <Helmet>
                <title>{pageTitle}</title>
                <meta property="og:title" content={pageTitle} />
                <meta property="og:description" content={pageDescription} />
                {pageImage && <meta property="og:image" content={pageImage} />}
            </Helmet>
            {children}
        </>
    );
}
