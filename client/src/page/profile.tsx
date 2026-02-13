import { t } from "i18next";
import { useContext, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { ButtonWithLoading } from "../components/button";
import { Input } from "../components/input";
import { client } from "../main";
import { ProfileContext } from "../state/profile";


export function ProfilePage() {
    const profile = useContext(ProfileContext);
    const [, setLocation] = useLocation();
    const [username, setUsername] = useState('');
    const [avatar, setAvatar] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Load current profile data and redirect to login if not authenticated
    useEffect(() => {
        if (profile === undefined) {
            // Still loading, wait
            return;
        }
        if (profile === null) {
            // Not authenticated, redirect to login
            setLocation('/login');
            return;
        }
        // Load current profile data
        setUsername(profile.name || '');
        setAvatar(profile.avatar || '');
    }, [profile, setLocation]);

    const handleAvatarClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Check file size (max 2MB)
        if (file.size > 2 * 1024 * 1024) {
            setError(t('profile.error.file_too_large'));
            return;
        }

        // Check file type
        if (!file.type.startsWith('image/')) {
            setError(t('profile.error.invalid_file_type'));
            return;
        }

        // Convert to base64
        const reader = new FileReader();
        reader.onload = (event) => {
            const base64 = event.target?.result as string;
            setAvatar(base64);
        };
        reader.readAsDataURL(file);
    };

    const handleSubmit = async () => {
        if (!username.trim()) {
            setError(t('profile.error.empty_username'));
            return;
        }

        setIsLoading(true);
        setError('');
        setSuccess('');

        try {
            const { error: apiError } = await client.user.updateProfile({ 
                username: username.trim(),
                avatar: avatar || null
            });

            if (apiError) {
                setError(t('profile.error.update_failed'));
                setIsLoading(false);
                return;
            }

            setSuccess(t('profile.success'));
            // Refresh page to update profile context
            setTimeout(() => {
                window.location.reload();
            }, 1000);
        } catch (err) {
            setError(t('profile.error.network'));
        } finally {
            setIsLoading(false);
        }
    };

    if (profile === undefined) {
        return (
            <div className="py-8 px-4 my-32 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-theme"></div>
            </div>
        );
    }

    if (profile === null) {
        return null;
    }

    return (
        <div className="py-8 px-4 my-8">
            <div className="max-w-2xl mx-auto bg-w rounded-2xl shadow-lg p-8">
                <h1 className="text-2xl font-bold mb-8 t-primary">{t('profile.title')}</h1>

                {/* Error message */}
                {error && (
                    <p className="text-sm text-red-500 mb-4">{error}</p>
                )}

                {/* Success message */}
                {success && (
                    <p className="text-sm text-green-500 mb-4">{success}</p>
                )}

                <div className="space-y-6">
                    {/* Avatar section */}
                    <div className="flex flex-col items-center space-y-4">
                        <label className="text-sm font-medium t-secondary">{t('profile.avatar')}</label>
                        <div 
                            className="relative w-32 h-32 rounded-full overflow-hidden cursor-pointer border-4 border-theme hover:opacity-80 transition-opacity"
                            onClick={handleAvatarClick}
                        >
                            {avatar ? (
                                <img 
                                    src={avatar} 
                                    alt="Avatar" 
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                <div className="w-full h-full bg-secondary flex items-center justify-center">
                                    <i className="ri-user-line text-4xl text-neutral-400"></i>
                                </div>
                            )}
                            <div className="absolute inset-0 bg-black bg-opacity-30 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                                <i className="ri-camera-line text-white text-2xl"></i>
                            </div>
                        </div>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={handleFileChange}
                        />
                        <p className="text-xs t-secondary">{t('profile.avatar_hint')}</p>
                    </div>

                    {/* Username section */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium t-secondary">{t('profile.username')}</label>
                        <Input
                            value={username}
                            setValue={setUsername}
                            placeholder={t('profile.username_placeholder')}
                            disabled={isLoading}
                        />
                    </div>

                    {/* Submit button */}
                    <div className="pt-4">
                        <ButtonWithLoading
                            title={isLoading ? t('profile.saving') : t('profile.save')}
                            onClick={handleSubmit}
                            loading={isLoading}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
