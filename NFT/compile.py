import json
import os
import subprocess
import sys
from solcx import install_solc
import pathlib

def compile_contract():
    print("🔧 Installing/Checking Solc version 0.8.20...")
    install_solc('0.8.20')
    
    # Try to find executable
    try:
        # Newer versions
        from solcx import get_executable
        solc_path = get_executable('0.8.20')
    except ImportError:
        try:
            # Older versions - maybe get_solc_executable?
            from solcx import get_solc_executable
            solc_path = get_solc_executable('0.8.20')
        except ImportError:
            # Manual path construction
            print("⚠️ Could not find get_executable in solcx, trying manual path...")
            home = pathlib.Path.home()
            # Default location on Windows
            solc_path = home / ".solcx" / "solc-v0.8.20" / "solc.exe"
            
    if not os.path.exists(str(solc_path)):
         print(f"❌ Solc not found at {solc_path}")
         return
    
    print(f"🔨 Using solc at: {solc_path}")

    # Paths
    base_path = os.getcwd()
    contract_path = 'NFT/contracts/tChartXYZ.sol'
    output_dir = 'NFT/contracts/compiled'
    
    # Ensure output dir exists
    os.makedirs(output_dir, exist_ok=True)
    
    # Construct command
    # using --base-path . and --include-path node_modules to resolve @openzeppelin without remappings hell
    cmd = [
        str(solc_path),
        '--base-path', '.',
        '--include-path', 'node_modules',
        '--output-dir', output_dir,
        '--abi', '--bin',
        '--overwrite',
        contract_path
    ]
    
    print(f"🚀 Running command: {' '.join(cmd)}")
    
    try:
        result = subprocess.run(
            cmd, 
            cwd=base_path, 
            capture_output=True, 
            text=True, 
            encoding='utf-8' # Force utf-8 for output
        )
        
        if result.returncode != 0:
            print("❌ Compilation failed!")
            print("STDERR:")
            print(result.stderr)
            print("STDOUT:")
            print(result.stdout)
            return

        print("STDOUT:", result.stdout)
        
        # Now we need to organize the output because solc --abi --bin outputs files like:
        # tChartXYZ.abi, tChartXYZ.bin OR ContractName.abi
        # It creates file per contract.
        
        # We want to bundle tChartXYZ.abi and .bin into tChartXYZ.json format expected by deploy script
        
        abi_file = os.path.join(output_dir, 'tChartXYZ.abi')
        bin_file = os.path.join(output_dir, 'tChartXYZ.bin')
        
        if not os.path.exists(abi_file):
            # Maybe it is named differently?
            # Solc uses ContractName.abi usually.
            print("⚠️ Warning: tChartXYZ.abi not found. Listing output dir:")
            print(os.listdir(output_dir))
            # Try to find any .abi file
            for f in os.listdir(output_dir):
                if f.endswith('.abi') and 'tChartXYZ' in f:
                    abi_file = os.path.join(output_dir, f)
                    bin_file = os.path.join(output_dir, f.replace('.abi', '.bin'))
                    break
        
        if os.path.exists(abi_file) and os.path.exists(bin_file):
            with open(abi_file, 'r', encoding='utf-8') as f:
                abi_data = json.load(f)
            
            with open(bin_file, 'r', encoding='utf-8') as f:
                bytecode = f.read().strip()
                
            combined = {
                "abi": abi_data,
                "bytecode": bytecode
            }
            
            json_output_path = os.path.join(output_dir, 'tChartXYZ.json')
            with open(json_output_path, 'w', encoding='utf-8') as f:
                json.dump(combined, f, indent=2)
                
            print(f"✅ Compiled and packaged successfully to {json_output_path}")
        else:
            print("❌ Could not find ABI or BIN files.")
            
    except Exception as e:
        print(f"❌ Execution error: {e}")

if __name__ == "__main__":
    compile_contract()
