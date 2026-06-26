"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { AuthGuard } from './components/AuthGuard';
import { useTheme } from './context/ThemeContext';
import Terms from './components/Terms';
import Onboarding from './components/Onboarding';
import HomeView from './components/HomeView';
import ChatView from './components/ChatView';
import ExamsView from './components/ExamsView';
import QuizView from './components/QuizView';
import ShukaansiView from './components/ShukaansiView';
import PdfReader from './components/PdfReader';

// New Views
import ProfileView from './components/ProfileView';
import ExamGeneratorView from './components/ExamGeneratorView';
import GroupsView from './components/GroupsView';
import BillingView from './components/BillingView';
import UsageView from './components/UsageView';
import SettingsView from './components/SettingsView';
import AboutView from './components/AboutView';

export default function AppWorkspace() {
  const router = useRouter();
  const { colors, isDark, setTheme, language, setLanguage, t } = useTheme();

  const [activeTab, setActiveTab] = useState<'home' | 'chat' | 'exams' | 'quiz' | 'shukaansi'>('home');
  const [currentView, setCurrentView] = useState<string>('home');
  const [userData, setUserData] = useState<any>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  // Mobile sidebar drawer state
  const [leftDrawerOpen, setLeftDrawerOpen] = useState(false);

  // PDF Reader State
  const [openPdf, setOpenPdf] = useState<{ url: string; title: string; type: string } | null>(null);

  // Load User Data
  useEffect(() => {
    const cached = localStorage.getItem('userData');
    if (cached) {
      setUserData(JSON.parse(cached));
    }
    setIsLoaded(true);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('userToken');
    localStorage.removeItem('userData');
    setUserData(null);
    router.push('/login');
  };

  const handleOnboardingComplete = (updatedUser: any) => {
    setUserData(updatedUser);
  };

  const handleTermsComplete = (updatedUser: any) => {
    setUserData(updatedUser);
  };

  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0D1117]">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // Helper component to render sidebar items
  const renderSidebarContent = (isMobile: boolean) => (
    <div className="flex flex-col h-full justify-between">
      <div className="flex flex-col gap-6">
        
        {/* User Card */}
        <div className="flex flex-col items-center text-center gap-3 py-4 select-none border-b border-gray-200/50 dark:border-gray-800/80">
          <div className="w-16 h-16 rounded-full bg-blue-500 flex items-center justify-center text-white text-2xl font-black shadow-md">
            {userData?.name ? userData.name.substring(0, 2).toUpperCase() : 'DP'}
          </div>
          <div>
            <h4 className="text-sm font-extrabold text-gray-900 dark:text-white">@{userData?.username || 'Darkpen Guest'}</h4>
            <span className="text-[10px] text-gray-500 font-bold block mt-0.5">{userData?.whatsapp_number}</span>
          </div>
          
          {/* Balance Badge */}
          <button 
            onClick={() => { setCurrentView('billing'); if (isMobile) setLeftDrawerOpen(false); }}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-[#0084FF] text-white text-xs font-black shadow-md hover:opacity-90 transition-all cursor-pointer"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
              <path d="M12 7.5a2.25 2.25 0 1 0 0 4.5 2.25 2.25 0 0 0 0-4.5Z" />
              <path fillRule="evenodd" d="M1.5 4.875C1.5 3.839 2.34 3 3.375 3h17.25c1.035 0 1.875.84 1.875 1.875v9.75c0 1.036-.84 1.875-1.875 1.875H3.375A1.875 1.875 0 0 1 1.5 14.625v-9.75ZM8.25 9.75a3.75 3.75 0 1 1 7.5 0 3.75 3.75 0 0 1-7.5 0ZM18.75 9a.75.75 0 0 0-.75.75v.008c0 .414.336.75.75.75h.008a.75.75 0 0 0 .75-.75V9.75a.75.75 0 0 0-.75-.75h-.008ZM4.5 9.75A.75.75 0 0 1 5.25 9h.008a.75.75 0 0 1 .75.75v.008a.75.75 0 0 1-.75.75H5.25a.75.75 0 0 1-.75-.75V9.75Z" clipRule="evenodd" />
              <path d="M2.25 18a.75.75 0 0 0 0 1.5c5.4 0 10.63.722 15.6 2.117a.75.75 0 0 0 .9-1.336 48.46 48.46 0 0 0-16.5-2.28Z" />
            </svg>
            <span>{userData?.balance || 0} Credits</span>
          </button>
        </div>

        {/* Categories List */}
        <div className="flex flex-col gap-4 select-none">
          
          {/* CATEGORY: WAXBARASHADA & AI */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[9px] font-black text-gray-400 dark:text-gray-550 uppercase tracking-widest pl-2">
              WAXBARASHADA & AI
            </span>
            <div className="flex flex-col gap-1">
              {/* Profile */}
              <button
                onClick={() => { setCurrentView('profile'); if (isMobile) setLeftDrawerOpen(false); }}
                className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-bold transition-all text-left ${currentView === 'profile' ? 'bg-[#0084FF]/10 text-[#0084FF]' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-200/50 dark:hover:bg-gray-800/40'}`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                </svg>
                <span>{t('profile')}</span>
              </button>

              {/* AI Exam Generator */}
              <button
                onClick={() => { setCurrentView('exam-generator'); if (isMobile) setLeftDrawerOpen(false); }}
                className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-bold transition-all text-left ${currentView === 'exam-generator' ? 'bg-[#0084FF]/10 text-[#0084FF]' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-200/50 dark:hover:bg-gray-800/40'}`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 21l8.982-8.983m-9 9 9-9m-9 9-2.25-2.25m11.25-6.75 2.25-2.25m-13.5 0h13.5M9 7.5h.008v.008H9V7.5Z" />
                </svg>
                <span className="flex-1">AI Exam Generator</span>
                <span className="px-1.5 py-0.5 rounded bg-[#0084FF] text-[8px] font-black text-white select-none">NEW</span>
              </button>

              {/* Books */}
              <button
                onClick={() => { setActiveTab('exams'); setCurrentView('exams'); if (isMobile) setLeftDrawerOpen(false); }}
                className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-bold transition-all text-left ${activeTab === 'exams' && currentView === 'exams' ? 'bg-[#0084FF]/10 text-[#0084FF]' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-200/50 dark:hover:bg-gray-800/40'}`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
                </svg>
                <span>{t('books')}</span>
              </button>

              {/* Groups */}
              <button
                onClick={() => { setCurrentView('groups'); if (isMobile) setLeftDrawerOpen(false); }}
                className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-bold transition-all text-left ${currentView === 'groups' ? 'bg-[#0084FF]/10 text-[#0084FF]' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-200/50 dark:hover:bg-gray-800/40'}`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
                </svg>
                <span>{t('groups')}</span>
              </button>
            </div>
          </div>

          {/* CATEGORY: AKOONKA & SETTINGS */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[9px] font-black text-gray-400 dark:text-gray-550 uppercase tracking-widest pl-2">
              AKOONKA & SETTINGS
            </span>
            <div className="flex flex-col gap-1">
              {/* Billing & Credits */}
              <button
                onClick={() => { setCurrentView('billing'); if (isMobile) setLeftDrawerOpen(false); }}
                className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-bold transition-all text-left ${currentView === 'billing' ? 'bg-[#0084FF]/10 text-[#0084FF]' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-200/50 dark:hover:bg-gray-800/40'}`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-5.625-10.125h16.5a2.25 2.25 0 0 1 2.25 2.25v10.5A2.25 2.25 0 0 1 21 21.75H3a2.25 2.25 0 0 1-2.25-2.25V5.625a2.25 2.25 0 0 1 2.25-2.25Z" />
                </svg>
                <span>Billing & Credits</span>
              </button>

              {/* Isticmaalka (Usage) */}
              <button
                onClick={() => { setCurrentView('usage'); if (isMobile) setLeftDrawerOpen(false); }}
                className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-bold transition-all text-left ${currentView === 'usage' ? 'bg-[#0084FF]/10 text-[#0084FF]' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-200/50 dark:hover:bg-gray-800/40'}`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6a7.5 7.5 0 1 0 7.5 7.5h-7.5V6Z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 10.5H21A7.5 7.5 0 0 0 13.5 3v7.5Z" />
                </svg>
                <span>Isticmaalka (Usage)</span>
              </button>

              {/* Settings */}
              <button
                onClick={() => { setCurrentView('settings'); if (isMobile) setLeftDrawerOpen(false); }}
                className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-bold transition-all text-left ${currentView === 'settings' ? 'bg-[#0084FF]/10 text-[#0084FF]' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-200/50 dark:hover:bg-gray-800/40'}`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.43l-1.003.828c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.43l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 0 1 0-.255c.007-.378-.138-.75-.43-.991l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                </svg>
                <span>{t('settings')}</span>
              </button>

              {/* About Darkpen */}
              <button
                onClick={() => { setCurrentView('about'); if (isMobile) setLeftDrawerOpen(false); }}
                className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-bold transition-all text-left ${currentView === 'about' ? 'bg-[#0084FF]/10 text-[#0084FF]' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-200/50 dark:hover:bg-gray-800/40'}`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 111.063.852l-.708.283a.75.75 0 00-.475.695v.283m0-.005H12m-.25-4.125h.008v.008h-.008V7.5Z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A8.953 8.953 0 0112 10.5c-2.997 0-5.704-1.464-7.414-3.71M21 12a9 9 0 11-18 0 9 9 0 0118 0Z" />
                </svg>
                <span>About Darkpen</span>
              </button>
            </div>
          </div>

          {/* Separation line */}
          <div className="h-[1px] bg-gray-200/50 dark:bg-gray-800/80 my-2" />

          {/* TOGGLES */}
          <div className="flex flex-col gap-3 pl-2">
            {/* Dark Mode toggle */}
            <div className="flex items-center justify-between text-xs font-bold text-gray-700 dark:text-gray-300">
              <div className="flex items-center gap-3">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z" />
                </svg>
                <span>Dark Mode</span>
              </div>
              <button
                onClick={() => setTheme(isDark ? 'light' : 'dark')}
                className="w-10 h-5.5 rounded-full bg-blue-500/10 border border-blue-500/20 relative flex items-center p-0.5 transition-all"
              >
                <div className={`w-4.5 h-4.5 rounded-full bg-[#0084FF] transition-all ${isDark ? 'translate-x-4.5' : 'translate-x-0'}`} />
              </button>
            </div>

            {/* Somali (SO) toggle */}
            <div className="flex items-center justify-between text-xs font-bold text-gray-700 dark:text-gray-300">
              <div className="flex items-center gap-3">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 21l5.25-11.25L21 21m-9-3h7.5M3 5.621a48.474 48.474 0 016-.371m0 0c1.12 0 2.233.038 3.334.114M9 5.25V3m3.334 2.364C11.176 10.658 7.69 15.08 3 17.502m9.334-12.138A14.25 14.25 0 0010.5 9.75" />
                </svg>
                <span>Somali (SO)</span>
              </div>
              <button
                onClick={() => setLanguage(language === 'en' ? 'so' : 'en')}
                className="w-10 h-5.5 rounded-full bg-blue-500/10 border border-blue-500/20 relative flex items-center p-0.5 transition-all"
              >
                <div className={`w-4.5 h-4.5 rounded-full bg-[#0084FF] transition-all ${language === 'so' ? 'translate-x-4.5' : 'translate-x-0'}`} />
              </button>
            </div>
          </div>

        </div>
      </div>

      {/* Log Out */}
      <button
        onClick={handleLogout}
        className="flex items-center gap-3 px-3 py-3.5 rounded-xl text-xs font-bold text-red-500 hover:bg-red-500/10 transition-all border border-red-500/10 text-left mt-6"
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4.5 h-4.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15M12 9l-3 3m0 0 3 3m-3-3h12.75" />
        </svg>
        <span>{t('logout')}</span>
      </button>
    </div>
  );

  return (
    <AuthGuard>
      {!userData?.terms_accepted_at ? (
        <Terms onComplete={handleTermsComplete} />
      ) : (!userData?.gender || !userData?.country) ? (
        <Onboarding onComplete={handleOnboardingComplete} />
      ) : (
        /* Main application layout */
        <div className="h-screen w-screen flex flex-col overflow-hidden bg-white dark:bg-[#0D1117] text-gray-900 dark:text-white">
          
          {/* ========================================================================= */}
          {/* DESKTOP LAYOUT (>= 1024px)                                                 */}
          {/* ========================================================================= */}
          <div className="hidden lg:flex flex-1 w-full h-full overflow-hidden select-none">
            
            {/* Panel 1: Left Sidebar Navigation */}
            <div className="w-[260px] h-full bg-[#F8F9FA] dark:bg-[#161B22] border-r border-gray-200 dark:border-gray-800 flex flex-col justify-between p-6">
              
              <div className="flex flex-col gap-8">
                {/* Brand */}
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 relative">
                    <Image src="/darkpen-logo-blue.png" alt="Darkpen" fill className="object-contain animate-pulse" />
                  </div>
                  <span className="text-lg font-black tracking-widest text-[#0084FF] uppercase">DARKPEN</span>
                </div>

                {/* Tabs navigation */}
                <nav className="flex flex-col gap-2">
                  <button
                    onClick={() => { setActiveTab('home'); setCurrentView('home'); setOpenPdf(null); }}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-extrabold transition-all text-left ${activeTab === 'home' && currentView === 'home' && !openPdf ? 'bg-[#0084FF]/10 text-[#0084FF]' : 'text-gray-500 hover:text-gray-950 dark:hover:text-white hover:bg-gray-200/30 dark:hover:bg-gray-800/30'}`}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4.5 h-4.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
                    </svg>
                    <span>{t('home')}</span>
                  </button>

                  <button
                    onClick={() => { setActiveTab('chat'); setCurrentView('chat'); setOpenPdf(null); }}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-extrabold transition-all text-left ${activeTab === 'chat' && currentView === 'chat' && !openPdf ? 'bg-[#0084FF]/10 text-[#0084FF]' : 'text-gray-500 hover:text-gray-950 dark:hover:text-white hover:bg-gray-200/30 dark:hover:bg-gray-800/30'}`}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4.5 h-4.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025 4.479 4.479 0 0 0-.115-1.68C3.753 15.82 3 13.987 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z" />
                    </svg>
                    <span>AI Assistant</span>
                  </button>

                  <button
                    onClick={() => { setActiveTab('exams'); setCurrentView('exams'); setOpenPdf(null); }}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-extrabold transition-all text-left ${activeTab === 'exams' && currentView === 'exams' && !openPdf ? 'bg-[#0084FF]/10 text-[#0084FF]' : 'text-gray-500 hover:text-gray-950 dark:hover:text-white hover:bg-gray-200/30 dark:hover:bg-gray-800/30'}`}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4.5 h-4.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
                    </svg>
                    <span>{t('books')} & Exams</span>
                  </button>

                  <button
                    onClick={() => { setActiveTab('quiz'); setCurrentView('quiz'); setOpenPdf(null); }}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-extrabold transition-all text-left ${activeTab === 'quiz' && currentView === 'quiz' && !openPdf ? 'bg-[#0084FF]/10 text-[#0084FF]' : 'text-gray-500 hover:text-gray-950 dark:hover:text-white hover:bg-gray-200/30 dark:hover:bg-gray-800/30'}`}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4.5 h-4.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 21l8.982-8.983m-9 9 9-9m-9 9-2.25-2.25m11.25-6.75 2.25-2.25m-13.5 0h13.5M9 7.5h.008v.008H9V7.5Z" />
                    </svg>
                    <span>Quiz Challenge</span>
                  </button>

                  <button
                    onClick={() => { setActiveTab('shukaansi'); setCurrentView('shukaansi'); setOpenPdf(null); }}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-extrabold transition-all text-left ${activeTab === 'shukaansi' && currentView === 'shukaansi' && !openPdf ? 'bg-pink-500/10 text-pink-500' : 'text-gray-500 hover:text-pink-650 hover:bg-gray-200/30 dark:hover:bg-gray-800/30'}`}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4.5 h-4.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z" />
                    </svg>
                    <span>My Love Chat</span>
                  </button>
                </nav>
              </div>

              {/* Logout Button */}
              <button
                onClick={handleLogout}
                className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-red-500 hover:bg-red-500/10 transition-all text-left"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15M12 9l-3 3m0 0 3 3m-3-3h12.75" />
                </svg>
                <span>{t('logout')}</span>
              </button>

            </div>

            {/* Panel 2: Center Content Panel */}
            <div className="flex-1 h-full overflow-hidden flex flex-col bg-white dark:bg-[#0D1117] border-r border-gray-200 dark:border-gray-800">
              {openPdf ? (
                <PdfReader
                  pdfUrl={openPdf.url}
                  title={openPdf.title}
                  type={openPdf.type}
                  onClose={() => setOpenPdf(null)}
                />
              ) : currentView === 'home' ? (
                <HomeView
                  userData={userData}
                  onSelectTab={(tab) => { setActiveTab(tab as any); setCurrentView(tab); }}
                  onOpenPdf={(url, title, type) => setOpenPdf({ url, title, type })}
                />
              ) : currentView === 'chat' ? (
                <ChatView 
                  onOpenSidebar={() => {}}
                  onOpenGroups={() => { setCurrentView('groups'); }}
                />
              ) : currentView === 'exams' ? (
                <ExamsView
                  onOpenPdf={(url, title, type) => setOpenPdf({ url, title, type })}
                  onOpenSidebar={() => {}}
                />
              ) : currentView === 'quiz' ? (
                <QuizView onOpenSidebar={() => {}} />
              ) : currentView === 'shukaansi' ? (
                <ShukaansiView onOpenSidebar={() => {}} />
              ) : currentView === 'profile' ? (
                <ProfileView
                  userData={userData}
                  onUpdateUser={(updated) => setUserData(updated)}
                  onClose={() => setCurrentView(activeTab)}
                />
              ) : currentView === 'exam-generator' ? (
                <ExamGeneratorView
                  userData={userData}
                  onUpdateUser={(updated) => setUserData(updated)}
                  onOpenPdf={(url, title, type) => setOpenPdf({ url, title, type })}
                  onClose={() => setCurrentView(activeTab)}
                />
              ) : currentView === 'groups' ? (
                <GroupsView
                  onClose={() => setCurrentView(activeTab)}
                />
              ) : currentView === 'billing' ? (
                <BillingView
                  onClose={() => setCurrentView(activeTab)}
                />
              ) : currentView === 'usage' ? (
                <UsageView
                  onClose={() => setCurrentView(activeTab)}
                  onGoToBilling={() => setCurrentView('billing')}
                />
              ) : currentView === 'settings' ? (
                <SettingsView
                  onClose={() => setCurrentView(activeTab)}
                />
              ) : currentView === 'about' ? (
                <AboutView
                  onClose={() => setCurrentView(activeTab)}
                />
              ) : null}
            </div>

            {/* Panel 3: Right Sidebar Drawer Content (Matches mobile layout drawer exactly) */}
            <div className="w-[280px] h-full bg-[#F8F9FA] dark:bg-[#161B22] flex flex-col p-6 overflow-y-auto">
              {renderSidebarContent(false)}
            </div>

          </div>

          {/* ========================================================================= */}
          {/* MOBILE LAYOUT (< 1024px)                                                  */}
          {/* ========================================================================= */}
          <div className="flex lg:hidden flex-col flex-1 w-full h-full overflow-hidden select-none relative">
            
            {/* Render PDF Reader Fullscreen Overlay for mobile */}
            {openPdf ? (
              <div className="absolute inset-0 z-50 bg-[#0D1117]">
                <PdfReader
                  pdfUrl={openPdf.url}
                  title={openPdf.title}
                  type={openPdf.type}
                  onClose={() => setOpenPdf(null)}
                />
              </div>
            ) : (
              <>
                {/* Header */}
                <header className="flex items-center justify-between px-4 py-3 bg-white dark:bg-[#161B22] border-b border-gray-150 dark:border-gray-800 select-none">
                  {/* Left drawer trigger */}
                  <button 
                    onClick={() => setLeftDrawerOpen(true)}
                    className="w-10 h-10 rounded-full flex items-center justify-center text-gray-500 hover:text-gray-900 dark:hover:text-white bg-gray-100 dark:bg-gray-800/40 border border-gray-200 dark:border-gray-800 transition-all"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                    </svg>
                  </button>

                  {/* App Name */}
                  <h1 className="text-base font-extrabold text-[#0084FF] tracking-widest uppercase">DARKPEN</h1>

                  {/* Settings redirect shortcut */}
                  <button 
                    onClick={() => setCurrentView('settings')}
                    className="w-10 h-10 rounded-full flex items-center justify-center text-gray-500 hover:text-gray-950 bg-gray-100 dark:bg-gray-800/40 border border-gray-200 dark:border-gray-800 transition-all"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.43l-1.003.828c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.43l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 0 1 0-.255c.007-.378-.138-.75-.43-.991l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
                    </svg>
                  </button>
                </header>

                {/* Content Area */}
                <main className="flex-1 w-full overflow-hidden flex flex-col bg-white dark:bg-[#0D1117] pb-22">
                  {currentView === 'home' ? (
                    <HomeView
                      userData={userData}
                      onSelectTab={(tab) => { setActiveTab(tab as any); setCurrentView(tab); }}
                      onOpenPdf={(url, title, type) => setOpenPdf({ url, title, type })}
                    />
                  ) : currentView === 'chat' ? (
                    <ChatView 
                      onOpenSidebar={() => setLeftDrawerOpen(true)}
                      onOpenGroups={() => { setCurrentView('groups'); }}
                    />
                  ) : currentView === 'exams' ? (
                    <ExamsView
                      onOpenPdf={(url, title, type) => setOpenPdf({ url, title, type })}
                      onOpenSidebar={() => setLeftDrawerOpen(true)}
                    />
                  ) : currentView === 'quiz' ? (
                    <QuizView onOpenSidebar={() => setLeftDrawerOpen(true)} />
                  ) : currentView === 'shukaansi' ? (
                    <ShukaansiView onOpenSidebar={() => setLeftDrawerOpen(true)} />
                  ) : currentView === 'profile' ? (
                    <ProfileView
                      userData={userData}
                      onUpdateUser={(updated) => setUserData(updated)}
                      onClose={() => setCurrentView(activeTab)}
                    />
                  ) : currentView === 'exam-generator' ? (
                    <ExamGeneratorView
                      userData={userData}
                      onUpdateUser={(updated) => setUserData(updated)}
                      onOpenPdf={(url, title, type) => setOpenPdf({ url, title, type })}
                      onClose={() => setCurrentView(activeTab)}
                    />
                  ) : currentView === 'groups' ? (
                    <GroupsView
                      onClose={() => setCurrentView(activeTab)}
                    />
                  ) : currentView === 'billing' ? (
                    <BillingView
                      onClose={() => setCurrentView(activeTab)}
                    />
                  ) : currentView === 'usage' ? (
                    <UsageView
                      onClose={() => setCurrentView(activeTab)}
                      onGoToBilling={() => setCurrentView('billing')}
                    />
                  ) : currentView === 'settings' ? (
                    <SettingsView
                      onClose={() => setCurrentView(activeTab)}
                    />
                  ) : currentView === 'about' ? (
                    <AboutView
                      onClose={() => setCurrentView(activeTab)}
                    />
                  ) : null}
                </main>

                {/* Bottom Navigation Tab Bar (Floating capsule matching screenshot 1) */}
                <div className="absolute bottom-0 left-0 right-0 z-40 px-4 pb-4 select-none">
                  <footer className="h-[68px] bg-white/95 dark:bg-[#161B22]/95 border border-gray-150 dark:border-gray-800 rounded-full flex items-center justify-around px-4 shadow-lg backdrop-blur">
                    {/* Home */}
                    <button
                      onClick={() => { setActiveTab('home'); setCurrentView('home'); }}
                      className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'home' && currentView === 'home' ? 'text-[#0084FF] scale-105' : 'text-gray-400 dark:text-gray-500'}`}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
                      </svg>
                      <span className="text-[10px] font-bold">{t('home')}</span>
                    </button>

                    {/* Chat */}
                    <button
                      onClick={() => { setActiveTab('chat'); setCurrentView('chat'); }}
                      className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'chat' && currentView === 'chat' ? 'text-[#0084FF] scale-105' : 'text-gray-400 dark:text-gray-500'}`}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025 4.479 4.479 0 0 0-.115-1.68C3.753 15.82 3 13.987 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z" />
                      </svg>
                      <span className="text-[10px] font-bold">Chat</span>
                    </button>

                    {/* Exams */}
                    <button
                      onClick={() => { setActiveTab('exams'); setCurrentView('exams'); }}
                      className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'exams' && currentView === 'exams' ? 'text-[#0084FF] scale-105' : 'text-gray-400 dark:text-gray-500'}`}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
                      </svg>
                      <span className="text-[10px] font-bold">Exams</span>
                    </button>

                    {/* Quiz */}
                    <button
                      onClick={() => { setActiveTab('quiz'); setCurrentView('quiz'); }}
                      className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'quiz' && currentView === 'quiz' ? 'text-[#0084FF] scale-105' : 'text-gray-400 dark:text-gray-500'}`}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 21l8.982-8.983m-9 9 9-9m-9 9-2.25-2.25m11.25-6.75 2.25-2.25m-13.5 0h13.5M9 7.5h.008v.008H9V7.5Z" />
                      </svg>
                      <span className="text-[10px] font-bold">Quiz</span>
                    </button>

                    {/* Shukaansi */}
                    <button
                      onClick={() => { setActiveTab('shukaansi'); setCurrentView('shukaansi'); }}
                      className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'shukaansi' && currentView === 'shukaansi' ? 'text-pink-500 scale-105' : 'text-gray-400 dark:text-gray-500'}`}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z" />
                      </svg>
                      <span className="text-[10px] font-bold">Shukaansi</span>
                    </button>
                  </footer>
                </div>
              </>
            )}

            {/* Mobile Left Sidebar Drawer */}
            {leftDrawerOpen && (
              <div className="absolute inset-0 z-50 flex animate-in fade-in duration-200 select-none">
                {/* Backdrop click close */}
                <div 
                  onClick={() => setLeftDrawerOpen(false)}
                  className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                />
                
                {/* Drawer */}
                <div className="relative w-[75%] h-full bg-[#F8F9FA] dark:bg-[#161B22] border-r border-gray-200 dark:border-gray-800 p-6 flex flex-col justify-between animate-in slide-in-from-left duration-300">
                  <div className="flex flex-col h-full">
                    
                    {/* Drawer Close Header */}
                    <div className="flex items-center justify-between pb-3 border-b border-gray-200 dark:border-gray-800">
                      <div className="flex items-center gap-2">
                        <div className="w-9 h-9 relative">
                          <Image src="/darkpen-logo-blue.png" alt="Darkpen" fill className="object-contain" />
                        </div>
                        <span className="text-sm font-black text-[#0084FF] uppercase tracking-widest">DARKPEN</span>
                      </div>
                      <button onClick={() => setLeftDrawerOpen(false)} className="text-gray-400 p-1">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>

                    {/* Scrollable list content */}
                    <div className="flex-1 overflow-y-auto scrollbar-none pt-4">
                      {renderSidebarContent(true)}
                    </div>
                  </div>
                </div>
              </div>
            )}

          </div>

        </div>
      )}
    </AuthGuard>
  );
}
