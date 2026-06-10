import os
import sys
import uvicorn

# Ensure the current directory is in sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

if __name__ == "__main__":
    import multiprocessing
    # Required for multiprocessing on Windows when using PyInstaller
    multiprocessing.freeze_support()
    
    import main
    
    # Run the uvicorn server
    # We set log_level to warning in production to reduce noise
    uvicorn.run(
        main.app, 
        host="127.0.0.1", 
        port=8000, 
        log_level="info",
        # Do not use reload=True when packaging
        reload=False,
    )
