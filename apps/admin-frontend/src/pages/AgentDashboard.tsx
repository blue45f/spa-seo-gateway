import {
  Activity,
  AlertCircle,
  Bot,
  Cpu,
  Layers,
  Plus,
  RefreshCw,
  Send,
  Settings,
  ShieldCheck,
  Terminal,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { useStore } from '../lib/store'

import type { ComponentProps } from 'react'

interface Message {
  id: string
  sender: 'user' | 'agent' | 'thought' | 'system'
  text: string
  timestamp: string
}

interface McpServer {
  name: string
  type: 'stdio' | 'sse'
  target: string
  connected: boolean
}

type FormSubmitHandler = NonNullable<ComponentProps<'form'>['onSubmit']>

function getMessageBubbleClass(sender: Message['sender']) {
  if (sender === 'user') {
    return 'bg-indigo-600 text-white rounded-tr-none'
  }
  if (sender === 'system') {
    return 'bg-white/5 border border-border text-muted-foreground text-xs rounded-lg'
  }
  return 'bg-white/10 dark:bg-black/40 border border-border/50 text-foreground rounded-tl-none shadow-sm'
}

export function AgentDashboard() {
  const lang = useStore((s) => s.lang)
  const [activeTab, setActiveTab] = useState<'console' | 'mcp' | 'safety' | 'observability'>(
    'console'
  )
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      sender: 'system',
      text:
        lang === 'ko'
          ? 'Google Antigravity 에이전트 세션이 준비되었습니다. 디폴트 모델: gemini-3.5-flash'
          : 'Google Antigravity Agent session initialized. Default model: gemini-3.5-flash',
      timestamp: new Date().toLocaleTimeString(),
    },
  ])
  const [inputText, setInputText] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [currentThoughts, setCurrentThoughts] = useState<string>('')

  // Model Settings
  const [selectedModel, setSelectedModel] = useState('gemini-3.5-flash')
  const [systemInstructions, setSystemInstructions] = useState(
    'You are a helpful coding assistant specialized in SEO gateways.'
  )

  // MCP State
  const [mcpServers, setMcpServers] = useState<McpServer[]>([
    {
      name: 'seo-validator-mcp',
      type: 'stdio',
      target: 'python3 mcp/seo_validator.py',
      connected: true,
    },
    {
      name: 'meta-scraper-remote',
      type: 'sse',
      target: 'https://mcp.seo-gateway.dev/sse',
      connected: false,
    },
  ])
  const [newMcpName, setNewMcpName] = useState('')
  const [newMcpType, setNewMcpType] = useState<'stdio' | 'sse'>('stdio')
  const [newMcpTarget, setNewMcpTarget] = useState('')

  // Safety Policies
  const [policies, setPolicies] = useState([
    { id: '1', name: 'deny_all()', description: 'Deny all tools by default', enabled: false },
    {
      id: '2',
      name: 'confirm_run_command()',
      description: 'Deny shell execution, allow other tools',
      enabled: true,
    },
    {
      id: '3',
      name: 'workspace_only()',
      description: 'Restrict file access to local workspace',
      enabled: true,
    },
    {
      id: '4',
      name: 'deny_rm_command',
      description: 'Deny run_command if command contains "rm"',
      enabled: true,
      isCustom: true,
    },
  ])

  // Observability & Token Metrics
  const [tokenUsage, setTokenUsage] = useState({
    prompt: 1420,
    candidates: 850,
    thoughts: 1100,
    total: 3370,
  })

  const chatEndRef = useRef<HTMLDivElement>(null)
  const appendMessage = (message: Message) => {
    setMessages((prev) => [...prev, message])
  }
  const addTokenUsage = (delta: Partial<typeof tokenUsage>) => {
    setTokenUsage((prev) => ({
      ...prev,
      prompt: prev.prompt + (delta.prompt ?? 0),
      candidates: prev.candidates + (delta.candidates ?? 0),
      thoughts: prev.thoughts + (delta.thoughts ?? 0),
      total: prev.total + (delta.total ?? 0),
    }))
  }

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, currentThoughts])

  // Simulated Chat Action
  const handleSendMessage: FormSubmitHandler = (e) => {
    e.preventDefault()
    if (!inputText.trim() || isTyping) return

    const userMsg: Message = {
      id: Date.now().toString(),
      sender: 'user',
      text: inputText,
      timestamp: new Date().toLocaleTimeString(),
    }

    appendMessage(userMsg)
    setInputText('')
    setIsTyping(true)
    setCurrentThoughts('')

    // Simulated thought & output stream
    let thoughtStep = 0
    const thoughtsList = [
      'Thinking: Analyzing input prompt...',
      'Thinking: Scanning local files using BuiltinTools.LIST_DIR...',
      'Thinking: Requesting SEO validator MCP server for canonical checks...',
      'Thinking: Validating answer compliance with Safety Policies...',
    ]

    const thoughtInterval = setInterval(() => {
      if (thoughtStep < thoughtsList.length) {
        setCurrentThoughts((prev) => prev + (prev ? '\n' : '') + thoughtsList[thoughtStep])
        addTokenUsage({ thoughts: 120, total: 120 })
        thoughtStep++
      } else {
        clearInterval(thoughtInterval)

        // Output response
        setTimeout(() => {
          const agentResponse: Message = {
            id: (Date.now() + 1).toString(),
            sender: 'agent',
            text:
              lang === 'ko'
                ? `[Google Antigravity Agent]\n요청하신 SEO 최적화 분석을 완료했습니다. 검사 결과, 현재 활성화된 MCP 서버와 연동하여 캐시 규칙에 따른 렌더 상태를 통과시켰습니다. 안전 정책에 의해 rm 등의 파괴적인 쉘 명령어는 엄격히 격리 차단된 상태입니다.`
                : `[Google Antigravity Agent]\nCompleted your requested SEO optimization analysis. Verified that the pre-rendered caching guidelines are satisfied via MCP server tools. Destructive terminal commands are blocked by the active safety predicate filter.`,
            timestamp: new Date().toLocaleTimeString(),
          }
          appendMessage(agentResponse)
          addTokenUsage({ prompt: 200, candidates: 150, total: 350 })
          setCurrentThoughts('')
          setIsTyping(false)
        }, 800)
      }
    }, 900)
  }

  const handleAddMcp: FormSubmitHandler = (e) => {
    e.preventDefault()
    if (!newMcpName.trim() || !newMcpTarget.trim()) return

    setMcpServers((prev) => [
      ...prev,
      {
        name: newMcpName,
        type: newMcpType,
        target: newMcpTarget,
        connected: true,
      },
    ])
    setNewMcpName('')
    setNewMcpTarget('')
  }

  const togglePolicy = (id: string) => {
    setPolicies((prev) =>
      prev.map((p) => {
        if (p.id === id) {
          // deny_all vs confirm_run_command exclusive toggle behavior for safety
          if (p.name === 'deny_all()' && !p.enabled) {
            return { ...p, enabled: true }
          }
          return { ...p, enabled: !p.enabled }
        }
        if (p.id !== id && p.name === 'confirm_run_command()' && id === '1') {
          return { ...p, enabled: false }
        }
        if (p.id !== id && p.name === 'deny_all()' && id === '2') {
          return { ...p, enabled: false }
        }
        return p
      })
    )
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto p-4 md:p-6 text-foreground bg-background transition-all duration-300">
      {/* Dynamic Glassmorphism Header */}
      <div className="relative overflow-hidden rounded-2xl border border-white/10 dark:border-black/30 p-6 md:p-8 bg-gradient-to-r from-blue-600/10 via-indigo-600/5 to-purple-600/10 backdrop-blur-xl">
        <div className="absolute top-0 right-0 w-64 h-64 bg-accent/10 rounded-full blur-3xl -z-10 animate-pulse" />
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gradient-to-tr from-blue-500 to-indigo-500 rounded-2xl text-white">
              <Bot className="h-8 w-8" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight bg-gradient-to-r from-blue-600 to-indigo-500 dark:from-blue-400 dark:to-indigo-300 bg-clip-text text-transparent">
                Google Antigravity Agent Console
              </h1>
              <p className="text-sm text-muted mt-1 max-w-xl">
                {lang === 'ko'
                  ? '구글 안티그래비티(AGY) SDK 기반의 자율 에이전트를 모니터링하고 가상 환경의 툴킷, 안전 필터, 통계를 통합 관리합니다.'
                  : 'Orchestrate, monitor, and audit autonomous AI agents built on the Google Antigravity (AGY) SDK.'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-white/5 dark:bg-black/20 border border-white/10 dark:border-black/30 px-3 py-1.5 rounded-full text-xs">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
            <span className="font-mono text-emerald-500 font-semibold uppercase tracking-wider">
              Active Run
            </span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border space-x-1 p-1 bg-white/5 dark:bg-black/10 rounded-lg">
        {[
          { id: 'console', label: lang === 'ko' ? '대화 콘솔' : 'Conversation', icon: Terminal },
          { id: 'mcp', label: lang === 'ko' ? 'MCP 연동' : 'MCP Servers', icon: Layers },
          {
            id: 'safety',
            label: lang === 'ko' ? '안전 정책' : 'Safety Policies',
            icon: ShieldCheck,
          },
          {
            id: 'observability',
            label: lang === 'ko' ? '관측 모니터' : 'Observability',
            icon: Activity,
          },
        ].map((tab) => {
          const Icon = tab.icon
          const active = activeTab === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as 'console' | 'mcp' | 'safety' | 'observability')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium transition-all ${
                active
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-muted hover:bg-white/5 hover:text-foreground'
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{tab.label}</span>
            </button>
          )
        })}
      </div>

      {/* Tab Contents */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Side: Dynamic Workspace Control & Settings */}
        <div className="lg:col-span-1 space-y-6">
          <div className="rounded-xl border border-border p-5 bg-card/50 backdrop-blur-sm space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-border">
              <Settings className="h-4 w-4 text-indigo-500" />
              <h2 className="font-semibold text-sm uppercase tracking-wider text-muted">
                Agent Config
              </h2>
            </div>

            <div className="space-y-3 text-sm">
              <div>
                <label
                  htmlFor="model-select"
                  className="block text-xs font-semibold mb-1 text-muted"
                >
                  Gemini Model Selection
                </label>
                <select
                  id="model-select"
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  className="w-full bg-white/5 dark:bg-black/20 border border-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:border-indigo-500"
                >
                  <option value="gemini-3.5-flash">gemini-3.5-flash (Default)</option>
                  <option value="gemini-1.5-pro">gemini-1.5-pro</option>
                  <option value="gemini-2.0-flash-exp">gemini-2.0-flash-exp</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="app-data-dir-input"
                  className="block text-xs font-semibold mb-1 text-muted"
                >
                  App Data Directory
                </label>
                <input
                  id="app-data-dir-input"
                  type="text"
                  value="~/.gemini/antigravity/brain/"
                  disabled
                  className="w-full bg-white/5 dark:bg-black/20 border border-border rounded-lg px-3 py-2 text-muted-foreground font-mono text-xs"
                />
              </div>

              <div>
                <label
                  htmlFor="system-instructions-input"
                  className="block text-xs font-semibold mb-1 text-muted"
                >
                  System Instructions
                </label>
                <textarea
                  id="system-instructions-input"
                  rows={4}
                  value={systemInstructions}
                  onChange={(e) => setSystemInstructions(e.target.value)}
                  className="w-full bg-white/5 dark:bg-black/20 border border-border rounded-lg px-3 py-2 text-foreground text-xs focus:outline-none focus:border-indigo-500 resize-none"
                />
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border p-5 bg-card/50 backdrop-blur-sm space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-border">
              <Cpu className="h-4 w-4 text-indigo-500" />
              <h2 className="font-semibold text-sm uppercase tracking-wider text-muted">
                Built-in Tools
              </h2>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {[
                { name: 'list_directory', status: 'Enabled' },
                { name: 'view_file', status: 'Enabled' },
                { name: 'edit_file', status: 'Enabled' },
                { name: 'run_command', status: 'Blocked (Default Policy)' },
                { name: 'ask_question', status: 'Enabled' },
                { name: 'start_subagent', status: 'Enabled' },
              ].map((tool) => (
                <div
                  key={tool.name}
                  className="p-2 rounded bg-white/5 dark:bg-black/10 border border-border/30"
                >
                  <div className="font-mono font-medium text-foreground">{tool.name}</div>
                  <div
                    className={`text-[10px] mt-0.5 ${tool.status.includes('Blocked') ? 'text-rose-500 font-semibold' : 'text-muted-foreground'}`}
                  >
                    {tool.status}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Side: Tab Contents Panel */}
        <div className="lg:col-span-2">
          {/* TAB 1: Conversational Console */}
          {activeTab === 'console' && (
            <div className="rounded-xl border border-border flex flex-col h-[550px] bg-card/30 backdrop-blur-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-border flex items-center justify-between bg-white/5 dark:bg-black/20">
                <div className="flex items-center gap-2">
                  <Terminal className="h-4 w-4 text-indigo-500" />
                  <span className="font-mono text-xs text-foreground">
                    Interactive Session ID: agy_conv_97ec4998
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setMessages([
                      {
                        id: '1',
                        sender: 'system',
                        text: 'Session reset. Reinitialized with default model gemini-3.5-flash.',
                        timestamp: new Date().toLocaleTimeString(),
                      },
                    ])
                  }}
                  className="p-1 hover:bg-white/5 rounded text-muted hover:text-foreground transition-all"
                  title="Clear history"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Message List */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 font-sans text-sm">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
                  >
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                      {msg.sender === 'agent' && <Bot className="h-3 w-3 text-indigo-500" />}
                      <span className="capitalize">{msg.sender}</span>
                      <span>•</span>
                      <span>{msg.timestamp}</span>
                    </div>
                    <div
                      className={`px-4 py-2.5 rounded-2xl max-w-[85%] whitespace-pre-wrap ${getMessageBubbleClass(msg.sender)}`}
                    >
                      {msg.text}
                    </div>
                  </div>
                ))}

                {/* Streaming Thoughts */}
                {currentThoughts && (
                  <div className="flex flex-col items-start w-full">
                    <div className="flex items-center gap-1.5 text-xs text-indigo-400 font-mono mb-1">
                      <RefreshCw className="h-3 w-3 animate-spin" />
                      <span>Thinking monologues (Inner thoughts)...</span>
                    </div>
                    <div className="px-4 py-3 bg-indigo-500/5 dark:bg-indigo-500/10 border border-indigo-500/20 rounded-2xl rounded-tl-none max-w-[85%] w-full font-mono text-xs text-indigo-400 whitespace-pre-wrap shadow-inner">
                      {currentThoughts}
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Chat Input */}
              <form
                onSubmit={handleSendMessage}
                className="p-3 border-t border-border bg-white/5 dark:bg-black/10 flex gap-2"
              >
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder={
                    lang === 'ko'
                      ? '에이전트에게 챗 메시지를 전송하세요...'
                      : 'Ask the agent to perform tasks...'
                  }
                  disabled={isTyping}
                  className="flex-1 bg-white/5 dark:bg-black/20 border border-border rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-indigo-500 disabled:opacity-50 text-foreground"
                />
                <button
                  type="submit"
                  aria-label={lang === 'ko' ? '메시지 전송' : 'Send message'}
                  disabled={isTyping || !inputText.trim()}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white p-2.5 rounded-lg transition-all disabled:opacity-50"
                >
                  <Send className="h-4 w-4" />
                </button>
              </form>
            </div>
          )}

          {/* TAB 2: MCP Server Configuration */}
          {activeTab === 'mcp' && (
            <div className="rounded-xl border border-border p-6 bg-card/30 backdrop-blur-sm space-y-6">
              <div>
                <h3 className="font-semibold text-lg text-foreground mb-1">
                  Model Context Protocol Integration
                </h3>
                <p className="text-xs text-muted">
                  {lang === 'ko'
                    ? '외부 도구 및 리소스에 동적 접속을 제공하는 MCP 서버 리포지토리입니다.'
                    : 'Connect and configure external Model Context Protocol services to yield dynamic tools.'}
                </p>
              </div>

              {/* Server List */}
              <div className="space-y-3">
                {mcpServers.map((server) => (
                  <div
                    key={server.name}
                    className="flex items-center justify-between p-4 rounded-xl border border-border bg-white/5 dark:bg-black/20"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-foreground">{server.name}</span>
                        <span className="bg-white/10 px-2 py-0.5 rounded text-[10px] uppercase font-mono">
                          {server.type}
                        </span>
                      </div>
                      <div className="font-mono text-xs text-muted-foreground">{server.target}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-2 h-2 rounded-full ${server.connected ? 'bg-emerald-500' : 'bg-rose-500'}`}
                      />
                      <span className="text-xs text-muted capitalize">
                        {server.connected ? 'Connected' : 'Disconnected'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Add Server Form */}
              <form onSubmit={handleAddMcp} className="border-t border-border pt-6 space-y-4">
                <h4 className="font-semibold text-sm text-foreground">Add New MCP Server</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="mcp-name-input"
                      className="block text-xs font-semibold mb-1 text-muted"
                    >
                      Server Name
                    </label>
                    <input
                      id="mcp-name-input"
                      type="text"
                      value={newMcpName}
                      onChange={(e) => setNewMcpName(e.target.value)}
                      placeholder="e.g. filesystem-server"
                      className="w-full bg-white/5 dark:bg-black/20 border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="mcp-transport-select"
                      className="block text-xs font-semibold mb-1 text-muted"
                    >
                      Transport Type
                    </label>
                    <select
                      id="mcp-transport-select"
                      value={newMcpType}
                      onChange={(e) => setNewMcpType(e.target.value as 'stdio' | 'sse')}
                      className="w-full bg-white/5 dark:bg-black/20 border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-indigo-500"
                    >
                      <option value="stdio">stdio (Local Command)</option>
                      <option value="sse">sse (Remote URL)</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label
                    htmlFor="mcp-target-input"
                    className="block text-xs font-semibold mb-1 text-muted"
                  >
                    Target Command / SSE Url
                  </label>
                  <input
                    id="mcp-target-input"
                    type="text"
                    value={newMcpTarget}
                    onChange={(e) => setNewMcpTarget(e.target.value)}
                    placeholder={
                      newMcpType === 'stdio'
                        ? 'python3 mcp_server.py'
                        : 'https://example.com/mcp/sse'
                    }
                    className="w-full bg-white/5 dark:bg-black/20 border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <button
                  type="submit"
                  disabled={!newMcpName.trim() || !newMcpTarget.trim()}
                  className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm transition-all disabled:opacity-50"
                >
                  <Plus className="h-4 w-4" />
                  <span>Register MCP Server</span>
                </button>
              </form>
            </div>
          )}

          {/* TAB 3: Safety Policies */}
          {activeTab === 'safety' && (
            <div className="rounded-xl border border-border p-6 bg-card/30 backdrop-blur-sm space-y-6">
              <div>
                <h3 className="font-semibold text-lg text-foreground mb-1">
                  Declarative Access Control Policies
                </h3>
                <p className="text-xs text-muted">
                  {lang === 'ko'
                    ? '에이전트가 실행하는 도구들의 보안 및 실행 여부를 우선순위에 따라 가로챕니다.'
                    : 'Configure priority-based security filters and predicate logic for tool calls.'}
                </p>
              </div>

              {/* Policy List */}
              <div className="space-y-3">
                {policies.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-start justify-between p-4 rounded-xl border border-border bg-white/5 dark:bg-black/20"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-semibold text-indigo-400">
                          {p.name}
                        </span>
                        {p.isCustom && (
                          <span className="bg-amber-500/10 text-amber-500 px-1.5 py-0.5 rounded text-[9px] font-semibold">
                            Custom Predicate
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{p.description}</p>
                    </div>

                    <button
                      type="button"
                      aria-label={`Toggle ${p.name}`}
                      onClick={() => togglePolicy(p.id)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${p.enabled ? 'bg-indigo-600' : 'bg-white/10 dark:bg-black/30 border border-border'}`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${p.enabled ? 'translate-x-6' : 'translate-x-1'}`}
                      />
                    </button>
                  </div>
                ))}
              </div>

              {/* Predicate Code Preview */}
              <div className="rounded-lg bg-white/5 dark:bg-black/40 border border-border/50 p-4 space-y-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-muted">
                  <ShieldCheck className="h-4 w-4 text-emerald-500" />
                  <span>Predicate Argument Checking Code</span>
                </div>
                <pre className="font-mono text-xs text-muted-foreground p-3 rounded bg-black/30 overflow-x-auto">
                  {`from google.antigravity.hooks import policy

# Deny shell execution if command contains dangerous keywords
policy.deny(
    "run_command",
    when=lambda args: "rm" in args.get("CommandLine", "").lower(),
    name="deny_rm_command"
)`}
                </pre>
              </div>
            </div>
          )}

          {/* TAB 4: Observability Monitor */}
          {activeTab === 'observability' && (
            <div className="rounded-xl border border-border p-6 bg-card/30 backdrop-blur-sm space-y-6">
              <div>
                <h3 className="font-semibold text-lg text-foreground mb-1">
                  Token Metrics & Observability
                </h3>
                <p className="text-xs text-muted">
                  {lang === 'ko'
                    ? '추론 토큰(Thinking Tokens)을 포함한 누적 API 비용 분석 및 감사 로그입니다.'
                    : 'Monitor API cumulative costs, execution audits, and token distributions.'}
                </p>
              </div>

              {/* Token Usage Breakdown */}
              <div className="grid grid-cols-4 gap-4">
                {[
                  {
                    label: 'Prompt Tokens',
                    value: tokenUsage.prompt,
                    color: 'bg-blue-500',
                    isTotal: false,
                  },
                  {
                    label: 'Candidates Tokens',
                    value: tokenUsage.candidates,
                    color: 'bg-emerald-500',
                    isTotal: false,
                  },
                  {
                    label: 'Thoughts Tokens',
                    value: tokenUsage.thoughts,
                    color: 'bg-indigo-500',
                    isTotal: false,
                  },
                  {
                    label: 'Total Tokens',
                    value: tokenUsage.total,
                    color: 'bg-indigo-600',
                    isTotal: true,
                  },
                ].map((token) => (
                  <div
                    key={token.label}
                    className={`p-4 rounded-xl border border-border bg-white/5 dark:bg-black/20 ${token.isTotal ? 'col-span-4 md:col-span-1 border-indigo-500/30' : ''}`}
                  >
                    <div className="text-[10px] uppercase font-bold text-muted mb-1">
                      {token.label}
                    </div>
                    <div className="text-xl font-bold font-mono text-foreground">
                      {token.value.toLocaleString()}
                    </div>
                    <div className={`h-1.5 rounded-full mt-2 ${token.color} opacity-75`} />
                  </div>
                ))}
              </div>

              {/* Progress visual bar */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-semibold text-muted">
                  <span>Usage Distribution Ratio</span>
                  <span>100%</span>
                </div>
                <div className="h-4 rounded-full overflow-hidden flex bg-white/10 dark:bg-black/30 border border-border/30">
                  <div
                    style={{ width: `${(tokenUsage.prompt / tokenUsage.total) * 100}%` }}
                    className="bg-blue-500 h-full"
                    title={`Prompt: ${Math.round((tokenUsage.prompt / tokenUsage.total) * 100)}%`}
                  />
                  <div
                    style={{ width: `${(tokenUsage.candidates / tokenUsage.total) * 100}%` }}
                    className="bg-emerald-500 h-full"
                    title={`Candidates: ${Math.round((tokenUsage.candidates / tokenUsage.total) * 100)}%`}
                  />
                  <div
                    style={{ width: `${(tokenUsage.thoughts / tokenUsage.total) * 100}%` }}
                    className="bg-indigo-500 h-full"
                    title={`Thoughts: ${Math.round((tokenUsage.thoughts / tokenUsage.total) * 100)}%`}
                  />
                </div>
                <div className="flex items-center gap-4 text-[10px] text-muted font-semibold mt-1">
                  <div className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-blue-500" />
                    <span>
                      Prompt ({Math.round((tokenUsage.prompt / tokenUsage.total) * 100)}%)
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span>
                      Candidates ({Math.round((tokenUsage.candidates / tokenUsage.total) * 100)}%)
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-indigo-500" />
                    <span>
                      Thoughts ({Math.round((tokenUsage.thoughts / tokenUsage.total) * 100)}%)
                    </span>
                  </div>
                </div>
              </div>

              {/* Audit Log Stream */}
              <div className="space-y-2">
                <div className="text-xs font-semibold text-muted flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-indigo-500" />
                  <span>Live Agent Audit Log Stream</span>
                </div>
                <div className="rounded-lg bg-black/40 border border-border/50 p-4 font-mono text-[11px] text-muted-foreground space-y-1 h-36 overflow-y-auto shadow-inner">
                  <div>
                    [2026-06-13 01:45:01] [INFO] [Agent] Session established. Conv ID:
                    agy_conv_97ec4998
                  </div>
                  <div>
                    [2026-06-13 01:45:10] [INFO] [Connection] Connected via LocalConnection using
                    gemini-3.5-flash
                  </div>
                  <div>
                    [2026-06-13 01:45:12] [INFO] [Safety] Registered default policy
                    confirm_run_command()
                  </div>
                  <div>
                    [2026-06-13 01:45:12] [INFO] [Safety] Registered predicate deny_rm_command
                  </div>
                  <div>
                    [2026-06-13 01:45:13] [INFO] [MCP] Connected stdio server "seo-validator-mcp"
                  </div>
                  <div>
                    [2026-06-13 01:45:13] [INFO] [MCP] Found 2 tools exposed by filesystem-server
                  </div>
                  <div>
                    [2026-06-13 01:45:20] [AUDIT] [PreToolCallDecideHook] Allow tool: list_directory
                  </div>
                  <div>
                    [2026-06-13 01:45:21] [AUDIT] [PostToolCallHook] Tool list_directory completed
                    successfully
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
