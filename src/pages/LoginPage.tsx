import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Laptop, Phone, Smartphone, Tv } from 'lucide-react';
import toast from 'react-hot-toast';

export function LoginPage() {
    const [phone, setPhone] = useState('');
    const [otp, setOtp] = useState('');
    const [step, setStep] = useState<'phone' | 'otp'>('phone');
    const [loading, setLoading] = useState(false);

    const { login } = useAuth();
    const navigate = useNavigate();

    const handleSendOTP = async (e: React.FormEvent) => {
        e.preventDefault();
        if (phone.length !== 10) {
            toast.error('Please enter a valid 10-digit mobile number');
            return;
        }

        setLoading(true);
        try {
            // In a real scenario, call: await api.post('/login/sendOTP', { number: phone })
            // Simulating API call for now
            await new Promise(res => setTimeout(res, 1000));

            toast.success('OTP sent successfully!');
            setStep('otp');
        } catch (error) {
            toast.error('Failed to send OTP. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyOTP = async (e: React.FormEvent) => {
        e.preventDefault();
        if (otp.length < 4) {
            toast.error('Please enter a valid OTP');
            return;
        }

        setLoading(true);
        try {
            // In a real scenario, call: await api.post('/login/verifyOTP', { number: phone, otp })
            // Simulating API call for now
            await new Promise(res => setTimeout(res, 1500));

            login(phone);
            toast.success('Login successful!');
            navigate('/');
        } catch (error) {
            toast.error('Invalid OTP. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 text-slate-200">
            <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
                <div className="flex justify-center text-rose-500 mb-4">
                    <Tv size={48} strokeWidth={1.5} />
                </div>
                <h2 className="text-center text-3xl font-extrabold text-white">
                    JioTV Go
                </h2>
                <p className="mt-2 text-center text-sm text-slate-400">
                    Stream your favorite channels anywhere
                </p>
            </div>

            <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
                <div className="bg-slate-900/50 backdrop-blur-xl py-8 px-4 shadow-2xl shadow-rose-500/10 sm:rounded-2xl sm:px-10 border border-slate-800">
                    {step === 'phone' ? (
                        <form className="space-y-6" onSubmit={handleSendOTP}>
                            <div>
                                <label htmlFor="phone" className="block text-sm font-medium text-slate-300">
                                    Jio Mobile Number
                                </label>
                                <div className="mt-1 relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <span className="text-slate-500 sm:text-sm">+91</span>
                                    </div>
                                    <input
                                        id="phone"
                                        name="phone"
                                        type="tel"
                                        maxLength={10}
                                        required
                                        value={phone}
                                        onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                                        className="appearance-none block w-full pl-12 px-3 py-3 border border-slate-700 bg-slate-800/50 rounded-lg shadow-sm placeholder-slate-400 focus:outline-none focus:ring-rose-500 focus:border-rose-500 sm:text-sm transition-colors text-white"
                                        placeholder="9876543210"
                                    />
                                </div>
                            </div>

                            <div>
                                <button
                                    type="submit"
                                    disabled={loading || phone.length !== 10}
                                    className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-rose-600 hover:bg-rose-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-rose-500 focus:ring-offset-slate-900 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                >
                                    {loading ? 'Sending OTP...' : 'Get OTP'}
                                </button>
                            </div>
                        </form>
                    ) : (
                        <form className="space-y-6" onSubmit={handleVerifyOTP}>
                            <div>
                                <label htmlFor="otp" className="block text-sm font-medium text-slate-300">
                                    Enter OTP sent to +91 {phone}
                                </label>
                                <div className="mt-1">
                                    <input
                                        id="otp"
                                        name="otp"
                                        type="text"
                                        required
                                        value={otp}
                                        onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                                        className="appearance-none block w-full px-3 py-3 border border-slate-700 bg-slate-800/50 rounded-lg shadow-sm placeholder-slate-400 focus:outline-none focus:ring-rose-500 focus:border-rose-500 sm:text-sm transition-colors text-white text-center tracking-widest font-mono text-lg"
                                        placeholder="••••••"
                                    />
                                </div>
                            </div>

                            <div className="flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setStep('phone')}
                                    disabled={loading}
                                    className="w-1/3 flex justify-center py-3 px-4 border border-slate-700 rounded-lg shadow-sm text-sm font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500 disabled:opacity-50 transition-all"
                                >
                                    Back
                                </button>
                                <button
                                    type="submit"
                                    disabled={loading || otp.length < 4}
                                    className="w-2/3 flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-rose-600 hover:bg-rose-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-rose-500 focus:ring-offset-slate-900 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                >
                                    {loading ? 'Verifying...' : 'Login'}
                                </button>
                            </div>
                        </form>
                    )}

                    <div className="mt-8 pt-6 border-t border-slate-800">
                        <div className="flex justify-center gap-6 text-slate-500">
                            <Smartphone size={20} />
                            <Laptop size={20} />
                            <Tv size={20} />
                        </div>
                        <p className="mt-4 text-center text-xs text-slate-500">
                            Works across all your devices
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
