#!/usr/bin/env bun
/**
 * 统一开发服务器
 * 同时启动前端和后端，并处理数据库迁移
 */

import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const ROOT_DIR = process.cwd();

// 颜色输出
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    dim: '\x1b[2m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
};

function log(label: string, message: string, color: string = colors.reset) {
    const timestamp = new Date().toLocaleTimeString('zh-CN', { hour12: false });
    console.log(`${colors.dim}[${timestamp}]${colors.reset} ${color}[${label}]${colors.reset} ${message}`);
}

// 检查配置文件
if (!fs.existsSync(path.join(ROOT_DIR, '.env.local'))) {
    log('Setup', '首次运行，正在初始化配置...', colors.yellow);
    
    // 运行配置生成脚本
    const setupProcess = spawn('bun', ['scripts/setup-dev.ts'], {
        stdio: 'inherit',
        cwd: ROOT_DIR
    });
    
    setupProcess.on('exit', (code) => {
        if (code !== 0) {
            process.exit(code || 1);
        }
        startDev();
    });
} else {
    // 检查是否需要重新生成配置
    const envStat = fs.statSync(path.join(ROOT_DIR, '.env.local'));
    const wranglerStat = fs.existsSync(path.join(ROOT_DIR, 'wrangler.toml')) 
        ? fs.statSync(path.join(ROOT_DIR, 'wrangler.toml'))
        : { mtime: new Date(0) };
    
    if (envStat.mtime > wranglerStat.mtime) {
        log('Setup', '检测到配置更新，正在重新生成...', colors.yellow);
        const setupProcess = spawn('bun', ['scripts/setup-dev.ts'], {
            stdio: 'inherit',
            cwd: ROOT_DIR
        });
        
        setupProcess.on('exit', (code) => {
            if (code !== 0) {
                process.exit(code || 1);
            }
            startDev();
        });
    } else {
        startDev();
    }
}

function startDev() {
    log('Dev', '启动开发服务器...', colors.green);
    
    // 先运行数据库迁移
    log('DB', '检查数据库迁移...', colors.cyan);
    const migrateProcess = spawn('bun', ['scripts/dev-migrator.ts'], {
        stdio: 'inherit',
        cwd: ROOT_DIR
    });
    
    migrateProcess.on('exit', (code) => {
        if (code !== 0) {
            log('DB', '数据库迁移失败', colors.red);
            process.exit(code || 1);
        }
        
        log('DB', '数据库迁移完成', colors.green);
        startServers();
    });
}

function startServers() {
    log('Dev', '正在启动前端和后端服务...', colors.green);
    
    // 启动后端
    const backend = spawn('bun', ['wrangler', 'dev', '--port', '11498'], {
        cwd: ROOT_DIR,
        env: { ...process.env }
    });
    
    // 启动前端
    const frontend = spawn('bun', ['--filter', './client', 'dev'], {
        cwd: ROOT_DIR,
        env: { ...process.env }
    });
    
    // 输出处理
    backend.stdout.on('data', (data) => {
        const lines = data.toString().split('\n').filter((l: string) => l.trim());
        lines.forEach((line: string) => {
            if (line.includes('Ready') || line.includes('http')) {
                log('Backend', line, colors.blue);
            } else if (line.includes('Error') || line.includes('error')) {
                log('Backend', line, colors.red);
            } else {
                log('Backend', line, colors.dim);
            }
        });
    });
    
    backend.stderr.on('data', (data) => {
        const lines = data.toString().split('\n').filter((l: string) => l.trim());
        lines.forEach((line: string) => log('Backend', line, colors.red));
    });
    
    frontend.stdout.on('data', (data) => {
        const lines = data.toString().split('\n').filter((l: string) => l.trim());
        lines.forEach((line: string) => {
            if (line.includes('Local') || line.includes('http')) {
                log('Frontend', line, colors.magenta);
            } else if (line.includes('Error') || line.includes('error')) {
                log('Frontend', line, colors.red);
            } else {
                log('Frontend', line, colors.dim);
            }
        });
    });
    
    frontend.stderr.on('data', (data) => {
        const lines = data.toString().split('\n').filter((l: string) => l.trim());
        lines.forEach((line: string) => log('Frontend', line, colors.red));
    });
    
    // 进程退出处理
    backend.on('exit', (code) => {
        log('Backend', `进程退出，代码: ${code}`, colors.red);
        frontend.kill();
        process.exit(code || 0);
    });
    
    frontend.on('exit', (code) => {
        log('Frontend', `进程退出，代码: ${code}`, colors.red);
        backend.kill();
        process.exit(code || 0);
    });
    
    // 优雅退出
    process.on('SIGINT', () => {
        log('Dev', '正在关闭开发服务器...', colors.yellow);
        backend.kill('SIGINT');
        frontend.kill('SIGINT');
    });
    
    process.on('SIGTERM', () => {
        backend.kill('SIGTERM');
        frontend.kill('SIGTERM');
    });
    
    // 显示访问信息
    setTimeout(() => {
        console.log('\n' + '='.repeat(60));
        console.log(`${colors.bright}🚀 开发服务器已启动！${colors.reset}`);
        console.log('='.repeat(60));
        console.log(`${colors.cyan}📱 前端地址:${colors.reset} http://localhost:5173`);
        console.log(`${colors.blue}🔌 后端地址:${colors.reset} http://localhost:11498`);
        console.log('='.repeat(60) + '\n');
    }, 3000);
}
