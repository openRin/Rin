import { useContext, useEffect, useRef, useState } from "react"
import { Helmet } from 'react-helmet'
import { client } from "../main"

import { siteName } from "../utils/constants"
import { useTranslation } from "react-i18next"
import { ProfileContext } from "../state/profile"
import { tryInt } from "../utils/int"
import { useSearch } from "wouter"
import { useAlert, useConfirm } from "../components/dialog"
import Modal from "react-modal"
import { MarkdownEditor } from "../components/markdown_editor"
import { Waiting } from "../components/loading"
import { MomentItem } from "../components/moment_item"

interface Moment {
    id: number;
    content: string;
    createdAt: Date;
    updatedAt: Date;
    user: {
        id: number;
        username: string;
        avatar: string;
    };
}

export function MomentsPage() {
    const [moments, setMoments] = useState<Moment[]>([])
    const [length, setLength] = useState(0)
    const [content, setContent] = useState("")
    const [loading, setLoading] = useState(false)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [editingMoment, setEditingMoment] = useState<Moment | null>(null)
    const query = new URLSearchParams(useSearch());
    const ref = useRef(false)
    const { t } = useTranslation()
    const profile = useContext(ProfileContext);
    const { showAlert, AlertUI } = useAlert()
    const { showConfirm, ConfirmUI } = useConfirm()
    
    const [currentPage, setCurrentPage] = useState(1)
    const [hasNextPage, setHasNextPage] = useState(false)
    const [loadingMore, setLoadingMore] = useState(false)
    
    const limit = tryInt(10, query.get("limit"), process.env.PAGE_SIZE)
    
    function fetchMoments(page = 1, append = false) {
        if (loadingMore) return
        
        const isInitialLoad = page === 1 && !append
        if (isInitialLoad) {
            setLoading(true)
        } else {
            setLoadingMore(true)
        }
        
        client.moments.list({
            page: page,
            limit: limit
        }).then(({ data }) => {
            if (data) {
                setLength(data.data.length)
                setHasNextPage(data.hasNext)
                
                if (append) {
                    setMoments(prev => [...prev, ...data.data] as any)
                } else {
                    setMoments(data.data as any)
                }
                
                setCurrentPage(page)
            }
        }).finally(() => {
            if (isInitialLoad) {
                setLoading(false)
            } else {
                setLoadingMore(false)
            }
        })
    }
    
    function loadMore() {
        if (hasNextPage && !loadingMore) {
            fetchMoments(currentPage + 1, true)
        }
    }
    
    function handleSubmit() {
        if (!content.trim()) return
        
        setLoading(true)
        
        if (editingMoment) {
            client.moments.update(editingMoment.id, { content })
            .then(({ error }) => {
                if (error) {
                    showAlert(t('update.failed$message', { message: error.value }))
                } else {
                    setContent("")
                    setEditingMoment(null)
                    setIsModalOpen(false)
                    fetchMoments(1, false)
                    showAlert(t('update.success'))
                }
            }).finally(() => {
                setLoading(false)
            })
        } else {
            client.moments.create({ content })
            .then(({ error }) => {
                if (error) {
                    showAlert(t('publish.failed$message', { message: error.value }))
                } else {
                    setContent("")
                    setIsModalOpen(false)
                    fetchMoments(1, false)
                    showAlert(t('publish.success'))
                }
            }).finally(() => {
                setLoading(false)
            })
        }
    }
    
    function handleEdit(moment: Moment) {
        setEditingMoment(moment)
        setContent(moment.content)
        setIsModalOpen(true)
    }
    
    function handleDelete(id: number) {
        showConfirm(
            t("delete.title"),
            t("delete.confirm"),
            () => {
                client.moments.delete(id).then(({ error }) => {
                    if (error) {
                        showAlert(t('delete.failed$message', { message: error.value }))
                    } else {
                        fetchMoments(1, false)
                        showAlert(t('delete.success'))
                    }
                })
            }
        )
    }
    
    function openCreateModal() {
        setEditingMoment(null)
        setContent("")
        setIsModalOpen(true)
    }
    
    useEffect(() => {
        if (ref.current) return
        fetchMoments(1, false)
        ref.current = true
    }, [])
    
    return (
        <>
            <Helmet>
                <title>{`${t('moments.title')} - ${process.env.NAME}`}</title>
                <meta property="og:site_name" content={siteName} />
                <meta property="og:title" content={t('moments.title')} />
                <meta property="og:image" content={process.env.AVATAR} />
                <meta property="og:type" content="article" />
                <meta property="og:url" content={document.URL} />
            </Helmet>
            <Waiting for={!loading}>
                <main className="w-full flex flex-col justify-center items-center mb-8 ani-show">
                    <div className="wauto text-start text-black dark:text-white py-4 text-4xl font-bold">
                        <p>
                            {t('moments.title')}
                        </p>
                        <div className="flex flex-row justify-between items-center">
                            <p className="text-sm mt-4 text-neutral-500 font-normal">
                                {t('moments.total$count', { count: length })}
                            </p>
                            {profile?.permission && (
                                <button 
                                    onClick={openCreateModal}
                                    className="text-sm font-normal rounded-full px-4 py-2 text-white bg-theme"
                                >
                                    {t('publish.title')}
                                </button>
                            )}
                        </div>
                    </div>
                    
                    <div className="wauto">
                        {moments && moments.length > 0 ? (
                            <div className="space-y-6">
                                {moments.map((moment) => (
                                    <MomentItem 
                                        key={moment.id} 
                                        moment={moment} 
                                        onDelete={handleDelete}
                                        onEdit={handleEdit}
                                        canManage={profile?.permission || false}
                                    />
                                ))}
                            </div>
                        ) : null}
                        
                        <Waiting for={!loadingMore}>
                            <div className="py-4 text-center">
                                {!hasNextPage && moments && moments.length > 0 ? (
                                    <div className="text-gray-500 pt-6">{t('no_more')}</div>
                                ) : hasNextPage ? (
                                    <button
                                        onClick={loadMore}
                                        className="text-sm font-normal rounded-full px-4 py-2 text-white bg-theme"
                                    >
                                        {t('load_more')}
                                    </button>
                                ) : null}
                            </div>
                        </Waiting>
                    </div>
                </main>
            </Waiting>
            
            <Modal 
                isOpen={isModalOpen}
                onRequestClose={() => setIsModalOpen(false)}
                style={{
                    content: {
                        top: '50%',
                        left: '50%',
                        right: 'auto',
                        bottom: 'auto',
                        marginRight: '-50%',
                        transform: 'translate(-50%, -50%)',
                        padding: '0',
                        border: 'none',
                        borderRadius: '16px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        alignItems: 'center',
                        background: 'transparent',
                        maxWidth: '90%',
                        width: '800px'
                    },
                    overlay: {
                        backgroundColor: 'rgba(0, 0, 0, 0.5)',
                        zIndex: 1000
                    }
                }}
            >
                <div className="w-full bg-w p-4 rounded-2xl shadow-xl">
                    <h2 className="text-2xl font-bold mb-4 t-primary">
                        {editingMoment ? t('moments.edit') : t('moments.publish')}
                    </h2>
                    
                    <div className="bg-w rounded-2xl t-primary">
                        <MarkdownEditor 
                            content={content}
                            setContent={setContent}
                            height="300px"
                        />
                    </div>
                    
                    <div className="flex justify-end mt-4 space-x-2">
                        <button
                            onClick={() => setIsModalOpen(false)}
                            className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-black dark:text-white rounded-lg"
                        >
                            {t('cancel')}
                        </button>
                        <button
                            onClick={handleSubmit}
                            disabled={loading || !content.trim()}
                            className="px-4 py-2 bg-theme text-white rounded-lg disabled:opacity-50"
                        >
                            {loading ? t('saving') : editingMoment ? t('update.title') : t('publish.title')}
                        </button>
                    </div>
                </div>
            </Modal>
            
            <AlertUI />
            <ConfirmUI />
        </>
    )
}