import type { ScmDocumentLine, ScmMaterialOption } from '@scm/api'
import { getWmsMaterialUnitFactor } from '@/utils/wms/material-quantity'
import { calculateTaxInclusiveUnitPrice } from '@/utils/finance/unit-price'

const roundMoney = (value: number): number => Math.round((value + Number.EPSILON) * 100) / 100

export function quotationTaxInclusivePrice(line: ScmDocumentLine): number {
  return calculateTaxInclusiveUnitPrice(line.unitPrice, line.taxRate)
}

export function calculateQuotationLine(line: ScmDocumentLine) {
  if (line.gift) return { discount: 0, amount: 0, tax: 0, total: 0 }
  const gross = Number(line.quantity) * line.unitPrice
  const discountRate = line.discountMode === 'none' ? 0 : (line.discountRate ?? 0) / 100
  const discount = roundMoney(
    Number(line.quantity) * quotationTaxInclusivePrice(line) * discountRate
  )
  const amount = roundMoney(gross * (1 - discountRate))
  const tax = roundMoney((amount * line.taxRate) / 100)
  return { discount, amount, tax, total: roundMoney(amount + tax) }
}

/** Contract totals follow the agreed line formulas; gifts contribute no receivable. */
export function calculateContractLine(line: ScmDocumentLine) {
  if (line.gift) return { discount: 0, amount: 0, tax: 0, total: 0 }
  const discountRate = line.discountMode === 'none' ? 0 : (line.discountRate ?? 0) / 100
  const discount = roundMoney(
    Number(line.quantity) * quotationTaxInclusivePrice(line) * discountRate
  )
  const amount = roundMoney(Number(line.quantity) * line.unitPrice - discount)
  const tax = roundMoney(Number(line.quantity) * line.unitPrice * (line.taxRate / 100))
  return { discount, amount, tax, total: roundMoney(amount + tax) }
}

export function contractAuxiliaryQuantity(
  quantity: number | null,
  unitId: string | null | undefined,
  material: ScmMaterialOption | undefined
): number | undefined {
  if (!unitId || !material || quantity == null || !Number.isFinite(quantity)) return undefined
  const conversion = material.unitConversions?.find((item) => item.sourceUnitId === unitId)
  if (!conversion || getWmsMaterialUnitFactor({ unitConversions: [conversion] }, unitId) === null)
    return undefined
  const converted =
    Math.round((quantity * conversion.sourceFactor * 1000) / conversion.baseFactor) / 1000
  return Number.isFinite(converted) ? converted : undefined
}
