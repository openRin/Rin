import { t } from "i18next";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { ButtonWithLoading } from "../components/button";
import { Icon } from "../components/icon";
import { Input } from "../components/input";
import { client, oauth_url } from "../main";
import { setAuthToken } from "../utils/auth";

export function LoginPage() {
    const [username, setUsername] = useState('')
    const [password, setPassword] = useState('')
    const [authStatus, setAuthStatus] = useState<{ github: boolean; password: boolean }>({ github: false, password: false });
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [, setLocation] = useLocation();

    // Fetch auth status on mount
    useEffect(() => {
        client.auth.status().then(({ data }) => {
            if (data) {
                setAuthStatus(data);
            }
        });
    }, []);

    const handleLogin = async () => {
        if (!username || !password) {
            setError(t('login.error.empty'));
            return;
        }

        setIsLoading(true);
        setError('');

        try {
            const { data, error: apiError } = await client.auth.login({ username, password });

            if (apiError) {
                setError(t('login.error.invalid'));
                setIsLoading(false);
                return;
            }

            if (data?.success) {
                // Save token to localStorage for cross-domain auth
                if (data.token) {
                    setAuthToken(data.token);
                }
                // Redirect to home page
                setLocation('/');
                window.location.reload();
            } else {
                setError(t('login.error.failed'));
            }
        } catch (err) {
            setError(t('login.error.network'));
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex items-center justify-center bg-secondary my-8">
            <div className="bg-w w-full max-w-md flex flex-col items-center justify-between p-8 space-y-4 t-primary rounded-2xl shadow-lg">
                <p className="text-2xl font-bold">{t('login.title')}</p>

                {/* Error message */}
                {error && (
                    <p className="text-sm text-red-500">{error}</p>
                )}

                {/* Password login form */}
                {authStatus.password && (
                    <>
                        <Input
                            value={username}
                            setValue={setUsername}
                            placeholder={t('login.username.placeholder')}
                            disabled={isLoading}
                            autofocus
                        />
                        <Input
                            value={password}
                            setValue={setPassword}
                            placeholder={t('login.password.placeholder')}
                            type="password"
                            onSubmit={handleLogin}
                            disabled={isLoading}
                        />
                        <div className="flex flex-row items-center space-x-4 pt-2">
                            <ButtonWithLoading
                                title={isLoading ? t("login.loading") : t("login.title")}
                                onClick={handleLogin}
                                loading={isLoading}
                            />
                        </div>
                    </>
                )}

                {/* OAuth options */}
                {authStatus.github && (
                    <div className="flex flex-col justify-center items-center space-y-2 pt-2">
                        {authStatus.password && <p className="text-xs t-secondary">{t('login.or')}</p>}
                        {!authStatus.password && <p className="text-xs t-secondary">{t('login.oauth_only')}</p>}
                        <div className="flex flex-row items-center space-x-4">
                            <Icon label={t('github_login')} name="ri-github-line" onClick={() => {
                                window.location.href = `${oauth_url}`
                            }} hover={true} />
                        </div>
                    </div>
                )}

                {/* No auth methods available */}
                {!authStatus.github && !authStatus.password && (
                    <p className="text-sm text-red-500">{t('login.no_methods')}</p>
                )}
            </div>
        </div>
    );
}
