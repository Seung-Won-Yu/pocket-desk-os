import { History, Menu, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type React from "react";
import { handleMenuKeyboard } from "../shell/keyboardNav";

type CalculatorMode = "standard" | "scientific";

type CalculatorAction =
  | "clear"
  | "clear-entry"
  | "delete"
  | "equals"
  | "toggle-sign"
  | "percent"
  | "pi"
  | "sqrt"
  | "square"
  | "reciprocal"
  | "sin"
  | "cos"
  | "tan"
  | "log"
  | "ln";

type CalculatorButton = {
  action?: CalculatorAction;
  className?: string;
  label: string;
  value?: string;
};

const calculatorStandardButtons: CalculatorButton[] = [
  { action: "percent", className: "is-utility", label: "%" },
  { action: "clear-entry", className: "is-utility", label: "CE" },
  { action: "clear", className: "is-utility", label: "C" },
  { action: "delete", className: "is-utility", label: "⌫" },
  { action: "reciprocal", className: "is-utility", label: "1/x" },
  { action: "square", className: "is-utility", label: "x²" },
  { action: "sqrt", className: "is-utility", label: "²√x" },
  { label: "÷", value: "/" },
  { label: "7", value: "7" },
  { label: "8", value: "8" },
  { label: "9", value: "9" },
  { label: "×", value: "*" },
  { label: "4", value: "4" },
  { label: "5", value: "5" },
  { label: "6", value: "6" },
  { label: "-", value: "-" },
  { label: "1", value: "1" },
  { label: "2", value: "2" },
  { label: "3", value: "3" },
  { label: "+", value: "+" },
  { action: "toggle-sign", className: "is-utility", label: "±" },
  { label: "0", value: "0" },
  { label: ".", value: "." },
  { action: "equals", className: "is-equals", label: "=" },
];

const calculatorScientificButtons: CalculatorButton[] = [
  { action: "sin", label: "sin" },
  { action: "cos", label: "cos" },
  { action: "tan", label: "tan" },
  { action: "sqrt", label: "√" },
  { action: "square", label: "x²" },
  { action: "reciprocal", label: "1/x" },
  { action: "log", label: "log" },
  { action: "ln", label: "ln" },
  { action: "pi", label: "π" },
];

export default function CalculatorApp() {
  const [display, setDisplay] = useState("0");
  const [mode, setMode] = useState<CalculatorMode>("standard");
  const [modeMenuOpen, setModeMenuOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [calculationHistory, setCalculationHistory] = useState<
    Array<{ expression: string; result: string }>
  >([]);
  const [memory, setMemory] = useState<number | null>(null);
  const calculatorRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    calculatorRef.current?.focus();
  }, []);

  const appendValue = (value: string) => {
    setDisplay((current) => appendCalculatorValue(current, value));
  };

  const applyUnary = (operation: (value: number) => number) => {
    setDisplay((current) => applyCalculatorUnary(current, operation));
  };

  const runAction = (action: CalculatorAction) => {
    if (action === "clear" || action === "clear-entry") {
      setDisplay("0");
      return;
    }

    if (action === "delete") {
      setDisplay((current) => (current.length > 1 ? current.slice(0, -1) : "0"));
      return;
    }

    if (action === "equals") {
      setDisplay((current) => {
        const result = evaluateExpression(current);
        const formatted = formatCalculatorResult(result);
        setCalculationHistory((historyItems) =>
          [{ expression: current, result: formatted }, ...historyItems].slice(0, 20),
        );
        return formatted;
      });
      return;
    }

    if (action === "toggle-sign") {
      setDisplay((current) => toggleCalculatorSign(current));
      return;
    }

    if (action === "percent") {
      applyUnary((value) => value / 100);
      return;
    }

    if (action === "pi") {
      setDisplay((current) => insertCalculatorPi(current));
      return;
    }

    if (action === "sqrt") applyUnary(Math.sqrt);
    if (action === "square") applyUnary((value) => value * value);
    if (action === "reciprocal") applyUnary((value) => 1 / value);
    if (action === "sin") applyUnary((value) => Math.sin(degreesToRadians(value)));
    if (action === "cos") applyUnary((value) => Math.cos(degreesToRadians(value)));
    if (action === "tan") applyUnary((value) => Math.tan(degreesToRadians(value)));
    if (action === "log") applyUnary(Math.log10);
    if (action === "ln") applyUnary(Math.log);
  };

  const getCurrentCalculatorValue = () => {
    const value = evaluateExpression(display);
    return Number.isFinite(value) ? value : 0;
  };

  const runMemoryAction = (action: "clear" | "recall" | "add" | "subtract" | "store") => {
    if (action === "clear") {
      setMemory(null);
      return;
    }
    if (action === "recall") {
      if (memory !== null) setDisplay(formatCalculatorResult(memory));
      return;
    }
    const value = getCurrentCalculatorValue();
    if (action === "store") setMemory(value);
    if (action === "add") setMemory((current) => (current ?? 0) + value);
    if (action === "subtract") setMemory((current) => (current ?? 0) - value);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;

    const key = event.key;
    const handled = () => {
      event.preventDefault();
      event.stopPropagation();
    };

    if (/^\d$/.test(key) || ["+", "-", "*", "/", "."].includes(key)) {
      handled();
      appendValue(key);
      return;
    }

    if (key === "Enter" || key === "=") {
      handled();
      runAction("equals");
      return;
    }

    if (key === "Backspace") {
      handled();
      runAction("delete");
      return;
    }

    if (key === "Delete" || key === "Escape" || key.toLowerCase() === "c") {
      handled();
      runAction("clear");
      return;
    }

    if (key === "%") {
      handled();
      runAction("percent");
      return;
    }

    if (key.toLowerCase() === "p") {
      handled();
      runAction("pi");
    }
  };

  const renderCalculatorButton = (button: CalculatorButton) => (
    <button
      className={button.className ?? ""}
      key={button.label}
      onClick={() =>
        button.action ? runAction(button.action) : appendValue(button.value ?? "")
      }
      type="button"
    >
      {button.label}
    </button>
  );

  return (
    <div
      className={`calculator-app calc-mode-${mode}`}
      onKeyDown={handleKeyDown}
      onPointerDown={() => calculatorRef.current?.focus()}
      ref={calculatorRef}
      tabIndex={0}
    >
      <div className="calc-header">
        <button
          aria-expanded={modeMenuOpen}
          aria-label="탐색 열기"
          onClick={() => {
            setModeMenuOpen((current) => !current);
            setHistoryOpen(false);
          }}
          title="탐색 열기"
          type="button"
        >
          <Menu aria-hidden="true" size={18} />
        </button>
        <strong>{mode === "standard" ? "표준" : "공학용"}</strong>
        <button
          aria-expanded={historyOpen}
          aria-label="기록"
          onClick={() => {
            setHistoryOpen((current) => !current);
            setModeMenuOpen(false);
          }}
          title="기록"
          type="button"
        >
          <History aria-hidden="true" size={18} />
        </button>
      </div>
      {modeMenuOpen && (
        <div
          className="calc-mode-menu"
          role="menu"
          onKeyDown={(event) => handleMenuKeyboard(event, event.currentTarget)}
        >
          {(["standard", "scientific"] as CalculatorMode[]).map((option) => (
            <button
              className={mode === option ? "is-selected" : ""}
              key={option}
              onClick={() => {
                setMode(option);
                setModeMenuOpen(false);
              }}
              role="menuitem"
              type="button"
            >
              {option === "standard" ? "표준" : "공학용"}
            </button>
          ))}
        </div>
      )}
      {historyOpen && (
        <aside className="calc-history-panel">
          <header>
            <strong>기록</strong>
            <button
              aria-label="기록 지우기"
              disabled={calculationHistory.length === 0}
              onClick={() => setCalculationHistory([])}
              title="기록 지우기"
              type="button"
            >
              <Trash2 aria-hidden="true" size={16} />
            </button>
          </header>
          {calculationHistory.length > 0 ? (
            <div>
              {calculationHistory.map((entry, index) => (
                <button
                  key={`${entry.expression}-${index}`}
                  onClick={() => {
                    setDisplay(entry.result);
                    setHistoryOpen(false);
                  }}
                  type="button"
                >
                  <small>{entry.expression} =</small>
                  <strong>{entry.result}</strong>
                </button>
              ))}
            </div>
          ) : (
            <p>아직 기록이 없습니다.</p>
          )}
        </aside>
      )}
      <output aria-label="계산기 표시창">{display}</output>
      <div className="calc-memory-row" aria-label="메모리">
        <button
          disabled={memory === null}
          onClick={() => runMemoryAction("clear")}
          type="button"
        >
          MC
        </button>
        <button
          disabled={memory === null}
          onClick={() => runMemoryAction("recall")}
          type="button"
        >
          MR
        </button>
        <button onClick={() => runMemoryAction("add")} type="button">
          M+
        </button>
        <button onClick={() => runMemoryAction("subtract")} type="button">
          M−
        </button>
        <button onClick={() => runMemoryAction("store")} type="button">
          MS
        </button>
      </div>
      {mode === "scientific" && (
        <div className="calc-grid calc-scientific-grid" aria-label="공학용 함수">
          {calculatorScientificButtons.map(renderCalculatorButton)}
        </div>
      )}
      <div className="calc-grid calc-standard-grid" aria-label="계산기 버튼">
        {calculatorStandardButtons.map(renderCalculatorButton)}
      </div>
    </div>
  );
}

function evaluateExpression(expression: string) {
  const tokens = tokenizeExpression(expression);
  if (tokens.length === 0) return Number.NaN;

  const firstPass: Array<number | string> = [];
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token === "*" || token === "/") {
      const previous = Number(firstPass.pop());
      const next = Number(tokens[index + 1]);
      firstPass.push(token === "*" ? previous * next : previous / next);
      index += 1;
    } else {
      firstPass.push(token);
    }
  }

  let total = Number(firstPass[0]);
  for (let index = 1; index < firstPass.length; index += 2) {
    const operator = firstPass[index];
    const next = Number(firstPass[index + 1]);
    total = operator === "+" ? total + next : total - next;
  }

  return total;
}

function tokenizeExpression(expression: string): string[] {
  if (!/^[\d+\-*/. ]+$/.test(expression)) return [];
  const tokens: string[] = [];
  let current = "";

  for (const char of expression.replace(/\s/g, "")) {
    const previousToken = tokens[tokens.length - 1];
    const unaryMinus =
      char === "-" && (tokens.length === 0 || ["+", "-", "*", "/"].includes(previousToken));
    if (/\d|\./.test(char) || unaryMinus) {
      current += char;
      continue;
    }
    if (current) {
      tokens.push(current);
      current = "";
    }
    tokens.push(char);
  }
  if (current) tokens.push(current);

  return tokens;
}

function appendCalculatorValue(current: string, value: string) {
  const operators = ["+", "-", "*", "/"];

  if (current === "Error") {
    return operators.includes(value) ? `0${value}` : value === "." ? "0." : value;
  }

  if (operators.includes(value)) {
    const last = current[current.length - 1];
    if (current === "0" && value === "-") return "-";
    if (last && operators.includes(last)) {
      if (value === "-" && last !== "-") return `${current}${value}`;
      return `${current.slice(0, -1)}${value}`;
    }
    return `${current}${value}`;
  }

  if (value === ".") {
    const last = current[current.length - 1];
    if (last && operators.includes(last)) return `${current}0.`;
    if (getCurrentCalculatorFragment(current).includes(".")) return current;
    return current === "0" ? "0." : `${current}.`;
  }

  if (/^\d$/.test(value)) {
    if (current === "0") return value;
    return `${current}${value}`;
  }

  return current;
}

function applyCalculatorUnary(expression: string, operation: (value: number) => number) {
  const input = evaluateExpression(expression);
  if (!Number.isFinite(input)) return "Error";
  return formatCalculatorResult(operation(input));
}

function toggleCalculatorSign(expression: string) {
  if (expression === "Error" || expression === "0") return "-";
  const fragment = getCurrentCalculatorFragment(expression);
  if (!fragment || fragment === "-") return expression;

  const start = expression.length - fragment.length;
  const nextFragment = fragment.startsWith("-") ? fragment.slice(1) : `-${fragment}`;
  return `${expression.slice(0, start)}${nextFragment}`;
}

function insertCalculatorPi(expression: string) {
  const pi = trimNumber(Math.PI);
  if (expression === "Error" || expression === "0") return pi;
  const last = expression[expression.length - 1];
  if (!last || ["+", "-", "*", "/"].includes(last)) return `${expression}${pi}`;
  return `${expression}*${pi}`;
}

function getCurrentCalculatorFragment(expression: string) {
  let start = expression.length;

  while (start > 0) {
    const char = expression[start - 1];
    if (char === "+" || char === "*" || char === "/") break;
    if (char === "-") {
      const before = expression[start - 2];
      if (start - 1 === 0 || ["+", "-", "*", "/"].includes(before)) {
        start -= 1;
        continue;
      }
      break;
    }
    start -= 1;
  }

  return expression.slice(start);
}

function formatCalculatorResult(value: number) {
  return Number.isFinite(value) ? trimNumber(value) : "Error";
}

function degreesToRadians(value: number) {
  return (value * Math.PI) / 180;
}

function trimNumber(value: number) {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(8)));
}
