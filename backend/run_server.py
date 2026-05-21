import sys
import os

# 添加自定义包目录到 Python 路径
packages_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'packages', 'Python313', 'site-packages')
sys.path.insert(0, packages_path)

# 设置环境变量
os.environ['PYTHONUSERBASE'] = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'packages')

# 现在启动 FastAPI 应用
import uvicorn
from main import app

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
