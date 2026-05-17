#!/usr/bin/env python3
import json
import os
import sys
from web3 import Web3
from eth_account import Account
from dotenv import load_dotenv

# Загрузка переменных из .env файла
load_dotenv()

# Конфигурация сети (Amoy Testnet)
# Alternative RPCs if reliable one fails:
# https://rpc-amoy.polygon.technology/
# https://rpc.ankr.com/polygon_amoy
# https://polygon-amoy.drpc.org
POLYGON_RPC_URL = "https://polygon-amoy.drpc.org"

# Адрес "Signer" (Кошелек сервера, который будет подписывать)
# Можно тоже вынести в .env: SIGNER_WALLET_ADDRESS
SIGNER_ADDRESS = "0xc1a7Ed62865CEA4D5B4778C1bE7dC890bB726FAf" 

def deploy_contract():
    private_key = os.getenv("DEPLOYER_PRIVATE_KEY")
    if not private_key:
        print("❌ Error: DEPLOYER_PRIVATE_KEY not found in .env file")
        print("💡 Validation: Add DEPLOYER_PRIVATE_KEY=your_private_key to .env")
        return

    print(f"🚀 Deploying tChartXYZ Contract to Amoy Testnet...")
    print(f"🔑 Signer Address will be: {SIGNER_ADDRESS}")

    web3 = Web3(Web3.HTTPProvider(POLYGON_RPC_URL))
    
    if not web3.is_connected():
        print(f"❌ Failed to connect to Polygon Amoy at {POLYGON_RPC_URL}")
        return

    account = Account.from_key(private_key)
    print(f"💰 Deployer: {account.address}")
    
    # Проверяем баланс
    balance = web3.eth.get_balance(account.address)
    print(f"💳 Balance: {web3.from_wei(balance, 'ether')} POL")
    
    if balance == 0:
        print("⚠️ Warning: Balance is 0. Deployment might fail.")

    # Загрузка скомпилированного контракта
    try:
        with open('NFT/contracts/compiled/tChartXYZ.json', 'r', encoding='utf-8') as f:
            data = json.load(f)
            abi = data['abi']
            bytecode = data['bytecode']
    except FileNotFoundError:
        print("❌ Compiled contract not found. Run compile.py first.")
        return

    contract = web3.eth.contract(abi=abi, bytecode=bytecode)
    
    # Оценка газа и построение транзакции
    print("🛠 Building transaction...")
    
    # Get gas price
    gas_price = web3.eth.gas_price
    print(f"⛽ Gas Price: {web3.from_wei(gas_price, 'gwei')} Gwei")
    
    # Estimate gas
    constructor_call = contract.constructor(SIGNER_ADDRESS)
    try:
        estimated_gas = constructor_call.estimate_gas({'from': account.address})
        print(f"⛽ Estimated Gas: {estimated_gas}")
    except Exception as e:
        print(f"⚠️ Gas estimation failed, using default: {e}")
        estimated_gas = 5000000 # Fallback
        
    # Calculate creation cost
    cost = gas_price * estimated_gas
    print(f"💰 Estimated Cost: {web3.from_wei(cost, 'ether')} POL")
    print(f"💰 Your Balance:  {web3.from_wei(balance, 'ether')} POL")
    
    if cost > balance:
        print("❌ Insufficient funds for deployment!")
        return

    construct_txn = constructor_call.build_transaction({
        'from': account.address,
        'nonce': web3.eth.get_transaction_count(account.address),
        'gasPrice': gas_price,
        'gas': int(estimated_gas * 1.2) # +20% buffer
    })

    # Подписание и отправка
    signed = web3.eth.account.sign_transaction(construct_txn, private_key=private_key)
    print("📡 Sending transaction...")
    
    tx_hash = signed.hash
    
    try:
        web3.eth.send_raw_transaction(signed.raw_transaction)
        print(f"⏳ Tx Hash: {tx_hash.hex()}")
    except Exception as e:
        # Check if error is "already known"
        err_str = str(e).lower()
        if "already known" in err_str or "code': 3" in err_str:
            print(f"⚠️ Transaction already known/pending. Waiting for existing Tx: {tx_hash.hex()}")
        else:
            print(f"❌ Deployment failed: {e}")
            return

    try:
        print("⏳ Waiting for receipt...")
        receipt = web3.eth.wait_for_transaction_receipt(tx_hash)
        print(f"🎉 Contract deployed at: {receipt.contractAddress}")
        
        # Сохраняем адрес
        with open('contract_address.txt', 'w', encoding='utf-8') as f:
            f.write(receipt.contractAddress)
            
    except Exception as e:
        print(f"❌ Error waiting for receipt: {e}")

if __name__ == "__main__":
    deploy_contract()
