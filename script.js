document.addEventListener('DOMContentLoaded', () => {
    // const API_BASE_URL = 'http://127.0.0.1:8000/api';
    // const API_BASE_URL = 'http://192.168.8.168:8000/api';
    // const API_BASE_URL = 'https://winning-gently-elf.ngrok-free.app/api'; // Your FastAPI backend URL
    const API_BASE_URL = 'https://34.82.80.145:8000/api'; // Your Render backend URL
    
    // Elements
    const accountBalanceEl = document.getElementById('accountBalance');
    const riskSlider = document.getElementById('riskSlider');
    const riskDisplay = document.getElementById('riskDisplay');
    const sliderFill = document.getElementById('sliderFill');
    const instrumentEl = document.getElementById('instrument');
    const entryPriceEl = document.getElementById('entryPrice');
    const slPriceEl = document.getElementById('slPrice');
    const instrumentInfoEl = document.getElementById('instrumentInfo');
    const currentPriceDisplay = document.getElementById('currentPriceDisplay');
    
    const fetchBalanceBtn = document.getElementById('fetchBalanceBtn');
    const fetchMarketPriceBtn = document.getElementById('fetchMarketPriceBtn');
    const calculateBtn = document.getElementById('calculateBtn');
    const buyBtn = document.getElementById('buyBtn');
    const sellBtn = document.getElementById('sellBtn');
    
    const resultsEl = document.getElementById('results');
    const resultLotSizeEl = document.getElementById('resultLotSize');
    const resultRiskAmountEl = document.getElementById('resultRiskAmount');
    const resultMoneyAtRiskPerLotEl = document.getElementById('resultMoneyAtRiskPerLot');
    const resultSLDistanceEl = document.getElementById('resultSLDistance');
    const resultRawLotEl = document.getElementById('resultRawLot');
    const resultMessageEl = document.getElementById('resultMessage');
    const resultMinLotInfoEl = document.getElementById('resultMinLotInfo');
    const errorDisplayEl = document.getElementById('errorDisplay');
    const errorMessageTextEl = document.getElementById('errorMessageText');
    const closeErrorBtn = document.getElementById('closeErrorBtn');
    const loadingIndicatorEl = document.getElementById('loadingIndicator');
    const successDisplayEl = document.getElementById('successDisplay');

    let instrumentsConfig = {};
    let currentDirection = 'BUY';

    // --- Risk Slider: Load from localStorage or default to 1 ---
    const storedRisk = localStorage.getItem('risk_percentage');
    if (storedRisk) {
        riskSlider.value = storedRisk;
        riskDisplay.textContent = storedRisk + '%';
        sliderFill.style.width = (storedRisk / 10 * 100) + '%';
    } else {
        riskSlider.value = 1;
        riskDisplay.textContent = '1%';
        sliderFill.style.width = '10%';
    }

    // --- Store risk percentage on change ---
    riskSlider.addEventListener('input', function() {
        const value = this.value;
        riskDisplay.textContent = value + '%';
        sliderFill.style.width = (value / 10 * 100) + '%';
        localStorage.setItem('risk_percentage', value);
    });

    // --- Hide balance until fetched ---
    accountBalanceEl.textContent = 'Fetch Balance';
    accountBalanceEl.classList.add('placeholder-balance');
    // Optionally, hide currency until fetched
    document.querySelector('.currency').style.display = 'none';

    // Trade direction buttons
    buyBtn.addEventListener('click', () => setDirection('BUY'));
    sellBtn.addEventListener('click', () => setDirection('SELL'));

    function setDirection(direction) {
        currentDirection = direction;
        buyBtn.classList.toggle('active', direction === 'BUY');
        sellBtn.classList.toggle('active', direction === 'SELL');
    }

    function displayError(message) {
        errorMessageTextEl.textContent = message;
        errorDisplayEl.style.display = 'block';
        errorDisplayEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        resultsEl.classList.remove('show');
    }

    function clearError() {
        errorMessageTextEl.textContent = '';
        errorDisplayEl.style.display = 'none';
    }

    closeErrorBtn.addEventListener('click', clearError);

    function showLoading(show, message = "Loading...") {
        loadingIndicatorEl.textContent = message;
        loadingIndicatorEl.style.display = show ? 'block' : 'none';
    }

    function showBtnLoader(btnType, show) {
        const loaders = {
            balance: document.getElementById('balanceLoader'),
            price: document.getElementById('priceLoader'),
            calc: document.getElementById('calcLoader')
        };
        if (loaders[btnType]) {
            loaders[btnType].style.display = show ? 'inline-block' : 'none';
        }
    }

    async function fetchApi(endpoint, options = {}, loadingMsg = "Loading...") {
        showLoading(true, loadingMsg);
        clearError();
        try {
            const existingHeaders = options.headers || {};
            const newHeaders = {
                ...existingHeaders,
                'ngrok-skip-browser-warning': 'any_value_is_fine'
            };

            // If requesting balance, add API key header if set
            if (endpoint === '/balance') {
                const userApiKey = getStoredApiKey();
                if (userApiKey) {
                    newHeaders['X-User-Api-Key'] = userApiKey;
                }
            }

            const fetchOptions = {
                ...options,
                headers: newHeaders
            };

            const response = await fetch(`${API_BASE_URL}${endpoint}`, fetchOptions);

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ detail: `HTTP error! Status: ${response.status}` }));
                throw new Error(errorData.detail || `HTTP error! Status: ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.error('API Fetch error:', error);
            displayError(error.message || 'Failed to fetch from API.');
            throw error;
        } finally {
            showLoading(false);
        }
    }

    async function loadInstruments() {
        try {
            const data = await fetchApi('/instruments');
            instrumentsConfig = data;
            instrumentEl.innerHTML = '<option value="">Select Instrument</option>';
            for (const key in instrumentsConfig) {
                const option = document.createElement('option');
                option.value = key;
                option.textContent = instrumentsConfig[key].description;
                instrumentEl.appendChild(option);
            }
            updateInstrumentInfo();
            updatePriceInputSteps();
        } catch (error) {
            displayError('Could not load instruments config.');
        }
    }
    
    function updatePriceInputSteps() {
        const selectedKey = instrumentEl.value;
        if (instrumentsConfig[selectedKey]) {
            const decimals = instrumentsConfig[selectedKey].price_decimals;
            const stepValue = Math.pow(10, -decimals).toFixed(decimals);
            entryPriceEl.step = stepValue;
            slPriceEl.step = stepValue;
        }
    }

    function updateInstrumentInfo() {
        const selectedKey = instrumentEl.value;
        if (instrumentsConfig[selectedKey]) {
            const config = instrumentsConfig[selectedKey];
            instrumentInfoEl.innerHTML = `
                API Symbol: ${config.api_symbol}<br>
                Tick Size: ${config.tick_size}, Tick Value: $${config.tick_value.toFixed(4)}<br>
                Min Lot: ${config.min_lot}, Lot Step: ${config.lot_step}
            `;
            updatePriceInputSteps();
        } else {
            instrumentInfoEl.innerHTML = '';
        }
    }

    instrumentEl.addEventListener('change', updateInstrumentInfo);

    // Balance button
    fetchBalanceBtn.addEventListener('click', async () => {
        showBtnLoader('balance', true);
        try {
            const data = await fetchApi('/balance', {}, "Retrieving balance...");
            const balance = data.balance.toFixed(2);
            accountBalanceEl.textContent = `$${balance}`;
            accountBalanceEl.classList.remove('placeholder-balance');
            document.querySelector('.currency').textContent = data.currency;
            document.querySelector('.currency').style.display = '';
            displaySuccess("Balance updated successfully!");
        } catch (error) { /* Error already displayed by fetchApi */ }
        showBtnLoader('balance', false);
    });

    // Fetch price button
    fetchMarketPriceBtn.addEventListener('click', async () => {
        showBtnLoader('price', true);
        const selectedKey = instrumentEl.value;
        if (!selectedKey || !instrumentsConfig[selectedKey]) {
            displayError("Please select a valid instrument first.");
            showBtnLoader('price', false);
            return;
        }
        const apiSymbol = instrumentsConfig[selectedKey].api_symbol;
        try {
            const data = await fetchApi(`/price/${apiSymbol}`);
            const priceToUse = currentDirection === 'BUY' ? 
                (data.ask !== null ? data.ask : data.spot) : 
                (data.bid !== null ? data.bid : data.spot);
                
            if (priceToUse !== null) {
                const formattedPrice = priceToUse.toFixed(instrumentsConfig[selectedKey].price_decimals);
                entryPriceEl.value = formattedPrice;
                currentPriceDisplay.textContent = formattedPrice;
                suggestStopLoss(priceToUse, currentDirection, selectedKey);
            } else {
                displayError(`Price not available for ${instrumentsConfig[selectedKey].description}.`);
            }
        } catch (error) { /* Error already handled */ }
        showBtnLoader('price', false);
    });

    // Calculate button
    calculateBtn.addEventListener('click', async () => {
        showBtnLoader('calc', true);
        clearError();
        resultsEl.classList.remove('show');

        // Extract balance number from display text
        const balanceText = accountBalanceEl.textContent.replace('$', '').replace(',', '');
        const balance = parseFloat(balanceText);

        const payload = {
            account_balance: balance,
            risk_percentage: parseFloat(riskSlider.value),
            instrument_key: instrumentEl.value,
            entry_price: parseFloat(entryPriceEl.value),
            sl_price: parseFloat(slPriceEl.value),
            direction: currentDirection
        };

        if (isNaN(payload.account_balance) || isNaN(payload.risk_percentage) ||
            isNaN(payload.entry_price) || isNaN(payload.sl_price) || !payload.instrument_key) {
            displayError("Please fill in all fields with valid numbers.");
            return;
        }

        try {
            const data = await fetchApi('/calculate-lot-size', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            resultsEl.classList.add('show');
            resultLotSizeEl.textContent = data.final_lot_size_formatted;
            resultRiskAmountEl.textContent = `$${data.risk_amount_currency.toFixed(2)}`;
            resultMoneyAtRiskPerLotEl.textContent = `$${data.money_at_risk_per_lot.toFixed(2)}`;
            resultSLDistanceEl.textContent = `${data.sl_distance_price_units.toFixed(instrumentsConfig[payload.instrument_key].price_decimals)} (${data.sl_distance_ticks.toFixed(0)} ticks)`;
            resultRawLotEl.textContent = data.raw_lot_size.toFixed(8);
            resultMessageEl.textContent = data.message || '';
            resultMinLotInfoEl.textContent = data.actual_risk_if_min_lot_info || '';
            resultMinLotInfoEl.style.display = data.actual_risk_if_min_lot_info ? 'block' : 'none';

        } catch (error) { /* Error already displayed by fetchApi */ }
        showBtnLoader('calc', false);
    });

    function suggestStopLoss(entryPrice, direction, instrumentKey) {
        const config = instrumentsConfig[instrumentKey];
        const defaultPips = 20;
        const pipValue = config.tick_size * 10;
        const slDistance = defaultPips * pipValue;
        
        const suggestedSL = direction === 'BUY' ? 
            entryPrice - slDistance : 
            entryPrice + slDistance;
            
        slPriceEl.value = suggestedSL.toFixed(config.price_decimals);
    }

    function validateStopLoss() {
        const entry = parseFloat(entryPriceEl.value);
        const sl = parseFloat(slPriceEl.value);
        
        if (isNaN(entry) || isNaN(sl)) return true;
        
        if (currentDirection === 'BUY' && sl >= entry) {
            displayError("For BUY orders, Stop Loss must be below Entry Price");
            return false;
        }
        if (currentDirection === 'SELL' && sl <= entry) {
            displayError("For SELL orders, Stop Loss must be above Entry Price");
            return false;
        }
        return true;
    }

    // Add direction change handler to validate SL
    buyBtn.addEventListener('click', () => {
        if (entryPriceEl.value && slPriceEl.value) {
            validateStopLoss();
        }
    });

    sellBtn.addEventListener('click', () => {
        if (entryPriceEl.value && slPriceEl.value) {
            validateStopLoss();
        }
    });

    // --- API Key Modal Logic ---
    const apiKeyBtn = document.getElementById('apiKeyBtn');
    const apiKeyModal = document.getElementById('apiKeyModal');
    const closeApiKeyModal = document.getElementById('closeApiKeyModal');
    const apiKeyInput = document.getElementById('apiKeyInput');
    const saveApiKeyBtn = document.getElementById('saveApiKeyBtn');

    // Store API key in localStorage for persistence
    function getStoredApiKey() {
        return localStorage.getItem('deriv_api_key') || '';
    }
    function setStoredApiKey(key) {
        localStorage.setItem('deriv_api_key', key);
    }

    apiKeyBtn.addEventListener('click', () => {
        apiKeyInput.value = getStoredApiKey();
        apiKeyModal.style.display = 'flex';
        apiKeyInput.focus();
    });
    closeApiKeyModal.addEventListener('click', () => {
        apiKeyModal.style.display = 'none';
    });
    saveApiKeyBtn.addEventListener('click', () => {
        setStoredApiKey(apiKeyInput.value.trim());
        apiKeyModal.style.display = 'none';
    });
    // Close modal on outside click
    window.addEventListener('click', (e) => {
        if (e.target === apiKeyModal) apiKeyModal.style.display = 'none';
    });

    function displaySuccess(message) {
        successDisplayEl.textContent = message;
        successDisplayEl.style.display = 'block';
        setTimeout(() => {
            successDisplayEl.style.display = 'none';
        }, 2500);
    }

    // Initial load
    loadInstruments();
});
