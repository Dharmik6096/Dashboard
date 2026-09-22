"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const FAQS = [
  {
    q: "How does DevOps Monitor connect to my servers?",
    a: "DevOps Monitor uses agentless SSH polling. You simply provide read-only SSH credentials, and the central server securely fetches telemetry using standard OS commands.",
  },
  {
    q: "Is DevOps Monitor safe to use in production?",
    a: "Yes. The SSH collector and AI are entirely read-only. They cannot restart services, modify configurations, kill processes, or write anything to your infrastructure. This is an architectural guarantee, not just a policy.",
  },
  {
    q: "What databases and services are supported?",
    a: "Currently supported: PostgreSQL, MySQL, Redis, RabbitMQ, Nginx, Docker containers, and Linux servers. More integrations are added regularly. Check the Integrations section for the latest list.",
  },
  {
    q: "How does the AI Investigation work?",
    a: "When an alert fires, the AI automatically correlates the anomaly with your service topology, logs, and recent metric changes. It identifies causal chains rather than just listing symptoms, and delivers a plain English explanation of what broke and why — in seconds.",
  },
  {
    q: "Can I self-host DevOps Monitor?",
    a: "Yes. DevOps Monitor is designed to run entirely on your own infrastructure via Docker Compose. No data leaves your environment unless you explicitly configure an external notification destination.",
  },
  {
    q: "How quickly can I get started?",
    a: "Most teams are seeing data within 10 minutes. Deploy the stack via Docker Compose, connect your first server via SSH, and the dashboard populates automatically. No configuration files needed for the initial setup.",
  },
];

export function FAQAccordion() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const toggle = (i: number) => setOpenIndex(prev => prev === i ? null : i);

  return (
    <div className="w-full max-w-4xl mx-auto flex flex-col gap-6">
      {FAQS.map((faq, i) => (
        <div key={i} className="bg-white border border-gray-200 rounded-3xl overflow-hidden shadow-sm hover:shadow-lg transition-all duration-300">
          <button
            className="w-full text-left px-8 py-6 flex items-center justify-between focus:outline-none group"
            onClick={() => toggle(i)}
          >
            <span className="font-bold text-lg text-gray-900 group-hover:text-blue-700 transition-colors">
              {faq.q}
            </span>
            <span className="ml-6 flex-shrink-0 w-10 h-10 rounded-full bg-gray-50 border border-gray-200 flex items-center justify-center group-hover:bg-blue-100 group-hover:border-blue-200 transition-colors">
              <ChevronDown
                size={18}
                className={`text-gray-500 group-hover:text-blue-600 transition-transform duration-300 ${openIndex === i ? "rotate-180" : "rotate-0"}`}
              />
            </span>
          </button>
          
          <AnimatePresence initial={false}>
            {openIndex === i && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
              >
                <div className="px-8 pb-8 pt-2 text-gray-600 text-base leading-relaxed">
                  {faq.a}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ))}
    </div>
  );
}
