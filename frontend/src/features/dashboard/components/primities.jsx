import React from 'react'

//Uniform card shell - 12px radius, hairline border, subtle slate shadow
export function Cart ({children, className=""}) {
    return (
        <div className={`rounded-xl border border-gray-200 bg-white shadow-card ${className}`}>
            {children}
        </div>
    )
}

//Section heading used above each grid block
export function SectionTitle ({title, subtitle, action}) {
    return (
        <div className="flex items-end justify-between">
            <div>
                <h2 className="text-[15px] font-semibold tracking-light text-gray-900">{title}</h2>
                {subtitle && <p className="mt-05 text-[12.5px] text-gray-500">{subtitle}</p>}
            </div>
            {action}
        </div>
    )
}

//Deterministic neutral avatar - initials on slate. Never random color hashes
export function Avatar ({intials, size = 36}) {
    return (
        <div className="flex shrink-0 items-center justify-center rounded-full bg-gray-100 font-semibold text-gray-600" style={{ width: size, height: size, fontSize: Math.round(size * 0.32) }}>
            {intials}
        </div>
    )
}