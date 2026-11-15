import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CurrencyCode, ExposureViewMode, NetWorthViewMode, PortfolioData, TabType } from './types/portfolio';
import {
  CACHE_TIMESTAMP_KEY,
  DEFAULT_API_URL,
  loadCachedRawData,
  parsePortfolioResponse,
  saveCachedRawData,
} from './utils/dataParser';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { KpiCardsRow } from './components/KpiCardsRow';
import { AccountStackedBar } from './components/AccountStackedBar';
import { PortfolioPerformanceChart } from './components/PortfolioPerformanceChart';
import { AssetAllocationAndGoal } from './components/AssetAllocationAndGoal';
import { LiveHoldingsTable } from './components/LiveHoldingsTable';
import { RebalancingSimulator } from './components/RebalancingSimulator';
import { MonthlySavingsChart } from './components/MonthlySavingsChart';
import { SavingsScheduleSection } from './components/SavingsScheduleSection';
import { ManualAndPhysicalAssetsCard } from './components/ManualAndPhysicalAssetsCard';
import { RecentActivityFeed } from './components/RecentActivityFeed';
import { TradeAndDividendSection } from './components/TradeAndDividendSection';
import { AiResearchSection } from './components/AiResearchSection';
import { AssetCopilotDrawer } from './components/AssetCopilotDrawer';

const POLLING_INTERVAL_MS = 300_000; // 5 minutes (300,000ms)
const POLLING_SECONDS = 300;

const tabContainerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.06,
      delayChildren: 0.04,
    },
  },
};

const widgetItemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: 'spring' as const,
      stiffness: 260,
      damping: 24,
    },
  },
};

export function App() {
  const apiUrl =
    (typeof window !== 'undefined' && (window as any).__STREAMLIT_CONFIG__?.PORTFOLIO_API_URL) ||
    import.meta.env.VITE_PORTFOLIO_API_URL ||
    DEFAULT_API_URL;

  // 0.1s Instant Render from localStorage / fallback snapshot
  const [portfolioData, setPortfolioData] = useState<PortfolioData>(() =>
    parsePortfolioResponse(loadCachedRawData())
  );

  const [lastUpdated, setLastUpdated] = useState<Date | null>(() => {
    try {
      const ts = localStorage.getItem(CACHE_TIMESTAMP_KEY);
      if (ts) return new Date(ts);
    } catch {
      // ignore
    }
    return new Date();
  });

  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [currency, setCurrency] = useState<CurrencyCode>('KRW');
  const [netWorthMode, setNetWorthMode] = useState<NetWorthViewMode>('TOTAL_WITH_PHYSICAL');
  const [exposureMode, setExposureMode] = useState<ExposureViewMode>('UNDERLYING');
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [isFromCache, setIsFromCache] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [secondsUntilRefresh, setSecondsUntilRefresh] = useState<number>(POLLING_SECONDS);

  const isFetchingRef = useRef<boolean>(false);

  const fetchLatestPortfolio = useCallback(async () => {
    if (isFetchingRef.current) return;
    const injectedPayload =
      typeof window !== 'undefined' ? (window as any).__STREAMLIT_CONFIG__?.INITIAL_PAYLOAD : null;
    if (!apiUrl) {
      if (injectedPayload) {
        setPortfolioData(parsePortfolioResponse(injectedPayload));
        setLastUpdated(new Date());
        setIsFromCache(false);
      }
      return;
    }
    isFetchingRef.current = true;
    setIsRefreshing(true);
    setErrorMsg(null);

    try {
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const rawJson = await response.json();
      const parsed = parsePortfolioResponse(rawJson);

      saveCachedRawData(rawJson);
      setPortfolioData(parsed);
      setLastUpdated(new Date());
      setIsFromCache(false);
      setSecondsUntilRefresh(POLLING_SECONDS);
    } catch (err: any) {
      console.warn('Portfolio API background fetch warning:', err);
      setErrorMsg(err?.message || '데이터 동기화 실패');
    } finally {
      isFetchingRef.current = false;
      setIsRefreshing(false);
    }
  }, [apiUrl]);

  // Initial background fetch on mount + 5-minute (300,000ms) auto-polling
  useEffect(() => {
    fetchLatestPortfolio();

    const pollTimer = setInterval(() => {
      fetchLatestPortfolio();
    }, POLLING_INTERVAL_MS);

    const countdownTimer = setInterval(() => {
      setSecondsUntilRefresh((prev) => (prev <= 1 ? POLLING_SECONDS : prev - 1));
    }, 1000);

    return () => {
      clearInterval(pollTimer);
      clearInterval(countdownTimer);
    };
  }, [fetchLatestPortfolio]);

  const usdKrwRate = portfolioData.usdKrwRate;

  return (
    <div className="min-h-screen bg-[#0B1116] text-white flex flex-col md:flex-row">
      {/* 1) Left Fixed Sidebar with Animated Tab Indicator */}
      <Sidebar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        nearestSavings={portfolioData.nearestMaturitySavings}
        currency={currency}
        usdKrwRate={usdKrwRate}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Sticky Header with API Live Self-Diagnostics, KRW/USD Switch, Last Updated Time & Manual Refresh */}
        <Header
          activeTab={activeTab}
          currency={currency}
          onToggleCurrency={setCurrency}
          lastUpdated={lastUpdated}
          baseDate={portfolioData.summary.baseDate}
          exchangeRate={usdKrwRate}
          isRefreshing={isRefreshing}
          isFromCache={isFromCache}
          errorMsg={errorMsg}
          secondsUntilRefresh={secondsUntilRefresh}
          diagnostics={portfolioData.diagnostics}
          onManualRefresh={fetchLatestPortfolio}
        />

        {/* Main Dashboard Canvas */}
        <main className="flex-1 p-5 sm:p-6 space-y-5 max-w-[1920px] w-full mx-auto">
          {/* 2) Top 4-Column KPI Summary Cards (with Staggered Entrance & Dual Net Worth Toggle) */}
          <KpiCardsRow
            data={portfolioData}
            currency={currency}
            usdKrwRate={usdKrwRate}
            netWorthMode={netWorthMode}
            onChangeNetWorthMode={setNetWorthMode}
          />

          {/* Horizontal Stacked Progress Bar (계좌별 자산 비중 가로 스택 바) */}
          <AccountStackedBar
            accounts={portfolioData.accountBreakdown}
            totalNetWorthKrw={portfolioData.summary.grandTotalKrw}
            currency={currency}
            usdKrwRate={usdKrwRate}
          />

          {/* Animated Tab-Specific Views */}
          <AnimatePresence mode="wait">
            {activeTab === 'dashboard' && (
              <motion.div
                key="tab-dashboard"
                variants={tabContainerVariants}
                initial="hidden"
                animate="visible"
                className="space-y-5"
              >
                {/* 3) Middle 2-Column Main Chart Area (65% : 35% ratio) */}
                <motion.div
                  variants={widgetItemVariants}
                  className="grid grid-cols-1 lg:grid-cols-[65fr_35fr] gap-5 items-stretch"
                >
                  <PortfolioPerformanceChart
                    history={portfolioData.assetHistory}
                    currency={currency}
                    usdKrwRate={usdKrwRate}
                  />
                  <AssetAllocationAndGoal
                    summary={portfolioData.summary}
                    integratedSummary={portfolioData.integratedSummary}
                    monthlySurplusKrw={portfolioData.cashflow.surplusKrw}
                    currency={currency}
                    usdKrwRate={usdKrwRate}
                    netWorthMode={netWorthMode}
                    exposureMode={exposureMode}
                    onChangeExposureMode={setExposureMode}
                  />
                </motion.div>

                {/* 4) Dedicated Cash & Manual Assets Card (수동 관리 입출금·현금·증여금·실물자산) */}
                <motion.div variants={widgetItemVariants}>
                  <ManualAndPhysicalAssetsCard
                    manualCashAccounts={portfolioData.manualCashAccounts}
                    manualCashTotalKrw={portfolioData.manualCashTotalKrw}
                    physicalAssets={portfolioData.physicalAssets}
                    physicalAssetsTotalKrw={portfolioData.physicalAssetsTotalKrw}
                    currency={currency}
                    usdKrwRate={usdKrwRate}
                  />
                </motion.div>

                {/* 5) Holdings Table (Left) + Monthly Savings & Cashflow + KIS Activity Feed (Bottom Right) */}
                <motion.div
                  variants={widgetItemVariants}
                  className="grid grid-cols-1 xl:grid-cols-[62fr_38fr] gap-5 items-stretch"
                >
                  <LiveHoldingsTable
                    holdings={portfolioData.holdings}
                    cashDeposits={portfolioData.cashDeposits}
                    totalCashDepositsKrw={portfolioData.totalCashDepositsKrw}
                    kisCount={portfolioData.kisHoldingsCount}
                    usCount={portfolioData.usStockHoldingsCount}
                    totalStockEvalKrw={portfolioData.totalStockEvalKrw}
                    totalStockProfitKrw={portfolioData.totalStockProfitKrw}
                    totalStockReturnRate={portfolioData.totalStockReturnRate}
                    currency={currency}
                    usdKrwRate={usdKrwRate}
                  />
                  <div className="flex flex-col gap-5">
                    <MonthlySavingsChart
                      savingsDist={portfolioData.savingsDist}
                      combinedCashflowBars={portfolioData.combinedCashflowBars}
                      cashflow={portfolioData.cashflow}
                      currency={currency}
                      usdKrwRate={usdKrwRate}
                    />
                    <RecentActivityFeed
                      activities={portfolioData.kisActivity}
                      currency={currency}
                      usdKrwRate={usdKrwRate}
                    />
                  </div>
                </motion.div>

                {/* 6) Interactive Rebalancing Simulator Widget */}
                <motion.div variants={widgetItemVariants}>
                  <RebalancingSimulator
                    rebalancingPlan={portfolioData.rebalancingPlan}
                    rebalancingPlanUnderlying={portfolioData.rebalancingPlanUnderlying}
                    integratedSummary={portfolioData.integratedSummary}
                    currency={currency}
                    usdKrwRate={usdKrwRate}
                    exposureMode={exposureMode}
                    onChangeExposureMode={setExposureMode}
                    compact
                  />
                </motion.div>
              </motion.div>
            )}

            {activeTab === 'portfolio' && (
              <motion.div
                key="tab-portfolio"
                variants={tabContainerVariants}
                initial="hidden"
                animate="visible"
                className="space-y-5"
              >
                <motion.div
                  variants={widgetItemVariants}
                  className="grid grid-cols-1 xl:grid-cols-[65fr_35fr] gap-5 items-stretch"
                >
                  <LiveHoldingsTable
                    holdings={portfolioData.holdings}
                    cashDeposits={portfolioData.cashDeposits}
                    totalCashDepositsKrw={portfolioData.totalCashDepositsKrw}
                    kisCount={portfolioData.kisHoldingsCount}
                    usCount={portfolioData.usStockHoldingsCount}
                    totalStockEvalKrw={portfolioData.totalStockEvalKrw}
                    totalStockProfitKrw={portfolioData.totalStockProfitKrw}
                    totalStockReturnRate={portfolioData.totalStockReturnRate}
                    currency={currency}
                    usdKrwRate={usdKrwRate}
                  />
                  <RecentActivityFeed
                    activities={portfolioData.kisActivity}
                    currency={currency}
                    usdKrwRate={usdKrwRate}
                  />
                </motion.div>
                <motion.div
                  variants={widgetItemVariants}
                  className="grid grid-cols-1 lg:grid-cols-[65fr_35fr] gap-5 items-stretch"
                >
                  <PortfolioPerformanceChart
                    history={portfolioData.assetHistory}
                    currency={currency}
                    usdKrwRate={usdKrwRate}
                  />
                  <AssetAllocationAndGoal
                    summary={portfolioData.summary}
                    integratedSummary={portfolioData.integratedSummary}
                    monthlySurplusKrw={portfolioData.cashflow.surplusKrw}
                    currency={currency}
                    usdKrwRate={usdKrwRate}
                    netWorthMode={netWorthMode}
                    exposureMode={exposureMode}
                    onChangeExposureMode={setExposureMode}
                  />
                </motion.div>
              </motion.div>
            )}

            {activeTab === 'trades' && (
              <motion.div
                key="tab-trades"
                variants={tabContainerVariants}
                initial="hidden"
                animate="visible"
                className="space-y-5"
              >
                <motion.div variants={widgetItemVariants}>
                  <TradeAndDividendSection
                    trades={portfolioData.kisTrades}
                    dividends={portfolioData.kisDividends}
                    currency={currency}
                    usdKrwRate={usdKrwRate}
                  />
                </motion.div>
              </motion.div>
            )}

            {activeTab === 'research' && (
              <motion.div
                key="tab-research"
                variants={tabContainerVariants}
                initial="hidden"
                animate="visible"
                className="space-y-5"
              >
                <motion.div variants={widgetItemVariants}>
                  <AiResearchSection
                    reports={portfolioData.geminiWeeklyReports}
                    watchlist={portfolioData.watchlistResearch}
                    saveTickerNews={portfolioData.saveTickerNews}
                    bullishTop5={portfolioData.bullishTop5}
                    bearishTop5={portfolioData.bearishTop5}
                    currency={currency}
                    usdKrwRate={usdKrwRate}
                  />
                </motion.div>
              </motion.div>
            )}

            {activeTab === 'rebalancing' && (
              <motion.div
                key="tab-rebalancing"
                variants={tabContainerVariants}
                initial="hidden"
                animate="visible"
                className="space-y-5"
              >
                <motion.div variants={widgetItemVariants}>
                  <RebalancingSimulator
                    rebalancingPlan={portfolioData.rebalancingPlan}
                    rebalancingPlanUnderlying={portfolioData.rebalancingPlanUnderlying}
                    integratedSummary={portfolioData.integratedSummary}
                    currency={currency}
                    usdKrwRate={usdKrwRate}
                    exposureMode={exposureMode}
                    onChangeExposureMode={setExposureMode}
                  />
                </motion.div>
                <motion.div
                  variants={widgetItemVariants}
                  className="grid grid-cols-1 lg:grid-cols-[65fr_35fr] gap-5 items-stretch"
                >
                  <LiveHoldingsTable
                    holdings={portfolioData.holdings}
                    cashDeposits={portfolioData.cashDeposits}
                    totalCashDepositsKrw={portfolioData.totalCashDepositsKrw}
                    kisCount={portfolioData.kisHoldingsCount}
                    usCount={portfolioData.usStockHoldingsCount}
                    totalStockEvalKrw={portfolioData.totalStockEvalKrw}
                    totalStockProfitKrw={portfolioData.totalStockProfitKrw}
                    totalStockReturnRate={portfolioData.totalStockReturnRate}
                    currency={currency}
                    usdKrwRate={usdKrwRate}
                  />
                  <AssetAllocationAndGoal
                    summary={portfolioData.summary}
                    integratedSummary={portfolioData.integratedSummary}
                    monthlySurplusKrw={portfolioData.cashflow.surplusKrw}
                    currency={currency}
                    usdKrwRate={usdKrwRate}
                    netWorthMode={netWorthMode}
                    exposureMode={exposureMode}
                    onChangeExposureMode={setExposureMode}
                  />
                </motion.div>
              </motion.div>
            )}

            {activeTab === 'cashflow' && (
              <motion.div
                key="tab-cashflow"
                variants={tabContainerVariants}
                initial="hidden"
                animate="visible"
                className="space-y-5"
              >
                <motion.div variants={widgetItemVariants}>
                  <ManualAndPhysicalAssetsCard
                    manualCashAccounts={portfolioData.manualCashAccounts}
                    manualCashTotalKrw={portfolioData.manualCashTotalKrw}
                    physicalAssets={portfolioData.physicalAssets}
                    physicalAssetsTotalKrw={portfolioData.physicalAssetsTotalKrw}
                    currency={currency}
                    usdKrwRate={usdKrwRate}
                  />
                </motion.div>
                <motion.div
                  variants={widgetItemVariants}
                  className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-stretch"
                >
                  <MonthlySavingsChart
                    savingsDist={portfolioData.savingsDist}
                    combinedCashflowBars={portfolioData.combinedCashflowBars}
                    cashflow={portfolioData.cashflow}
                    currency={currency}
                    usdKrwRate={usdKrwRate}
                  />
                  <AssetAllocationAndGoal
                    summary={portfolioData.summary}
                    integratedSummary={portfolioData.integratedSummary}
                    monthlySurplusKrw={portfolioData.cashflow.surplusKrw}
                    currency={currency}
                    usdKrwRate={usdKrwRate}
                    netWorthMode={netWorthMode}
                    exposureMode={exposureMode}
                    onChangeExposureMode={setExposureMode}
                  />
                </motion.div>
                <motion.div variants={widgetItemVariants}>
                  <SavingsScheduleSection
                    savings={portfolioData.savings}
                    bonds={portfolioData.bonds}
                    checkingAccounts={portfolioData.checkingAccounts}
                    currency={currency}
                    usdKrwRate={usdKrwRate}
                  />
                </motion.div>
              </motion.div>
            )}

            {activeTab === 'savings' && (
              <motion.div
                key="tab-savings"
                variants={tabContainerVariants}
                initial="hidden"
                animate="visible"
                className="space-y-5"
              >
                <motion.div variants={widgetItemVariants}>
                  <ManualAndPhysicalAssetsCard
                    manualCashAccounts={portfolioData.manualCashAccounts}
                    manualCashTotalKrw={portfolioData.manualCashTotalKrw}
                    physicalAssets={portfolioData.physicalAssets}
                    physicalAssetsTotalKrw={portfolioData.physicalAssetsTotalKrw}
                    currency={currency}
                    usdKrwRate={usdKrwRate}
                  />
                </motion.div>
                <motion.div variants={widgetItemVariants}>
                  <SavingsScheduleSection
                    savings={portfolioData.savings}
                    bonds={portfolioData.bonds}
                    checkingAccounts={portfolioData.checkingAccounts}
                    currency={currency}
                    usdKrwRate={usdKrwRate}
                  />
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>

      {/* Floating AI Copilot Drawer ('AssetCopilot') */}
      <AssetCopilotDrawer
        data={portfolioData}
        activeTab={activeTab}
        currency={currency}
        netWorthMode={netWorthMode}
        exposureMode={exposureMode}
      />
    </div>
  );
}

export default App;
