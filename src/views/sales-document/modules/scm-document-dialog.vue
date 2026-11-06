<template>
  <ArtDialog
    ref="dialogRef"
    size="xl"
    :loading="referencesLoading"
    loading-text="正在加载单据选项…"
  >
    <template #subtitle>维护单据表头与业务明细。金额会在保存时由数据库核算。</template>
    <div class="flex min-w-0 flex-col gap-4">
      <ArtAsyncState
        v-if="referenceError"
        :error="referenceError"
        error-title="单据选项加载失败"
        :min-height="96"
        @retry="loadReferences(header.tenantId)"
      />
      <ArtForm
        v-if="kind !== 'sales_contract'"
        ref="headerFormRef"
        v-model="header"
        :items="baseHeaderItems"
        :rules="headerRules"
        :validate-on-rule-change="false"
        :span="12"
        :gutter="20"
        label-width="112px"
        root-class="p-0!"
      >
        <template #layout="{ fields }">
          <div class="flex min-w-0 flex-col gap-4">
            <ArtSectionCard
              title="单据基本信息"
              subtitle="单据编号、项目和客户确定此单据的业务归属。"
            >
              <component :is="fields" :items="baseHeaderItems" :actions="false" />
            </ArtSectionCard>
          </div>
        </template>
      </ArtForm>

      <ArtSectionCard
        v-if="config.fields.length && kind !== 'project_quotation' && kind !== 'sales_contract'"
        title="业务信息"
        subtitle="按当前单据类型填写日期、地址和执行信息。"
      >
        <ArtForm
          ref="detailsFormRef"
          v-model="details"
          :items="detailItems"
          :rules="detailRules"
          :validate-on-rule-change="false"
          :span="12"
          :gutter="20"
          label-width="112px"
        >
        </ArtForm>
      </ArtSectionCard>

      <ArtSectionCard
        v-if="kind === 'project_quotation'"
        title="来源报价快照"
        subtitle="项目、施工号、工程子目和自动建档参数均从销售报价单带入；请在源单修改后重新生成。"
      >
        <p class="text-sm text-[var(--art-gray-700)]">
          已带入 {{ lines.length }} 行工程明细；销售报价单中设置的项目、物料与 BOM
          联动将在提交时执行。
        </p>
      </ArtSectionCard>

      <ArtEntitySummary
        v-if="kind === 'sales_contract'"
        :icon="config.icon"
        :eyebrow="config.eyebrow"
        :title="header.documentNo || '新销售合同'"
        :description="salesContractSummary"
      >
        <template #aside>
          <div class="text-right">
            <div class="text-xs text-[var(--art-gray-600)]">单据总价</div>
            <strong class="text-lg text-[var(--el-color-primary)]">{{
              formatCurrencyValue(previewTotal)
            }}</strong>
          </div>
        </template>
      </ArtEntitySummary>
      <ElTabs v-if="kind !== 'project_quotation'" v-model="activeTab" class="min-w-0">
        <ElTabPane v-if="kind === 'sales_contract'" name="base" label="单据信息">
          <div class="flex min-w-0 flex-col gap-4">
            <ArtSectionCard title="单据基本信息" subtitle="填写合同归属、项目、客户及签约信息。">
              <ArtForm
                ref="contractFormRef"
                :model-value="contractFormModel"
                :items="contractBaseItems"
                :rules="contractRules"
                :validate-on-rule-change="false"
                :span="8"
                :gutter="16"
                label-width="112px"
                root-class="p-0! md:p-0!"
              />
            </ArtSectionCard>
          </div>
        </ElTabPane>
        <ElTabPane
          :label="
            kind === 'sales_contract'
              ? '合同明细'
              : kind === 'sales_order'
                ? '订单明细'
                : kind === 'shipping_notice'
                  ? '发货明细'
                  : kind === 'sales_quotation'
                    ? '报价明细'
                    : '装车明细'
          "
          name="lines"
        >
          <ArtSectionCard
            v-if="kind === 'sales_quotation'"
            title="报价明细"
            subtitle="标准报价 · 填写未税或含税单价，系统同步计算金额与税额。"
          >
            <QuotationLineTable
              ref="quotationLineTableRef"
              v-model:lines="lines"
              quotation
              :materials="materialOptions"
              :display-unit-name="(value) => unitDisplayName(header.tenantId, value)"
              :units="engineeringReferences.units"
              :disabled="!header.tenantId"
              :source-options="materialSourceOptions"
              :tax-rates="taxRateOptions"
              :discount-options="discountOptions"
            />
          </ArtSectionCard>
          <ArtSectionCard
            v-if="kind === 'sales_contract'"
            title="合同明细"
            subtitle="参选报价明细或批量添加物料；合计行固定在表格底部。"
          >
            <QuotationLineTable
              ref="quotationLineTableRef"
              v-model:lines="lines"
              contract
              :quantity-optional="contractQuantityOptional"
              :project-id="header.projectId"
              :customer-id="header.customerId"
              :tenant-id="header.tenantId"
              :document-id="recordId"
              @source-selected="applySelectedLineSource"
              :quotation-documents="quotationDocuments"
              :materials="materialOptions"
              :display-unit-name="(value) => unitDisplayName(header.tenantId, value)"
              :disabled="!header.tenantId"
              :source-options="materialSourceOptions"
              :tax-rates="taxRateOptions"
              :discount-options="discountOptions"
            />
          </ArtSectionCard>
          <ArtSectionCard
            v-if="kind === 'sales_order'"
            title="订单明细"
            subtitle="从销售报价、合同参选明细，或批量添加物料；合计行固定在表格底部。"
          >
            <QuotationLineTable
              ref="quotationLineTableRef"
              v-model:lines="lines"
              order
              :quotation-documents="quotationDocuments"
              :contract-documents="contractDocuments"
              :project-id="header.projectId"
              :customer-id="header.customerId"
              :tenant-id="header.tenantId"
              :document-id="recordId"
              :default-delivery-date="header.deliveryDate"
              :materials="materialOptions"
              :display-unit-name="(value) => unitDisplayName(header.tenantId, value)"
              :disabled="!header.tenantId"
              :source-options="materialSourceOptions"
              :tax-rates="taxRateOptions"
              :discount-options="discountOptions"
              @source-selected="applySelectedLineSource"
            />
          </ArtSectionCard>
          <ArtSectionCard
            v-if="kind !== 'sales_quotation' && kind !== 'sales_contract' && kind !== 'sales_order'"
            :title="
              kind === 'shipping_notice' ? '发货明细' : kind === 'loading' ? '装车明细' : '物料明细'
            "
            :subtitle="
              kind === 'shipping_notice'
                ? header.sourceId
                  ? '已关联销售订单；可继续选取该订单的剩余明细。'
                  : '选单或直接添加物料；辅助数量按物料单位换算。'
                : kind === 'loading'
                  ? '按项目与客户选择待发货通知单明细，可在装车前调整数量。'
                  : '按单据维护物料、数量、价格、税率与成本；展开行可填写补充信息。'
            "
          >
            <QuotationLineTable
              ref="quotationLineTableRef"
              v-model:lines="lines"
              :operational="kind === 'shipping_notice' || kind === 'loading'"
              :default-delivery-date="header.deliveryDate"
              :shipping="kind === 'shipping_notice'"
              :loading="kind === 'loading'"
              :manual-disabled="
                kind === 'loading' ||
                config.sourceRequired ||
                (kind === 'shipping_notice' && Boolean(header.sourceId))
              "
              :materials="materialOptions"
              :display-unit-name="(value) => unitDisplayName(header.tenantId, value)"
              :units="engineeringReferences.units"
              :disabled="!header.tenantId"
              :source-options="materialSourceOptions"
              :tax-rates="taxRateOptions"
              :discount-options="discountOptions"
              @select-order="openShippingOrderPicker"
              @select-loading="openLoadingPicker"
            />
          </ArtSectionCard>
        </ElTabPane>

        <ElTabPane v-if="config.useFees" label="费用明细" name="fees">
          <ArtSectionCard
            title="费用明细"
            subtitle="费用定义来自当前租户的报价费用清单。"
            :empty="!fees.length"
            empty-title="暂无费用明细"
            empty-description="可从当前租户的报价费用清单添加。"
          >
            <template #actions>
              <ElButton type="primary" plain :disabled="!expenseOptions.length" @click="addFee">
                <ArtSvgIcon icon="ri:add-line" />
                添加费用
              </ElButton>
            </template>
            <ArtTable
              ref="feeTableRef"
              :data="fees"
              :columns="feeColumns"
              :pagination="false"
              row-key="expenseId"
              table-layout="fixed"
              border
              show-summary
              :summary-method="feeSummaryMethod"
              class="scm-quotation-summary-table"
              empty-text="暂无费用明细"
              empty-description="从当前租户的报价费用清单添加。"
            />
          </ArtSectionCard>
        </ElTabPane>

        <ElTabPane v-if="config.usePaymentPlans" label="收款计划" name="payments">
          <ArtSectionCard
            title="收款计划"
            subtitle="选择按比例或按金额记录每期应收。"
            :empty="!paymentPlans.length"
            empty-title="暂无收款计划"
            empty-description="添加计划后可记录每期应收。"
          >
            <template #actions>
              <ElButton type="primary" plain @click="addPaymentPlan">
                <ArtSvgIcon icon="ri:add-line" />
                添加计划
              </ElButton>
            </template>
            <ArtForm
              :model-value="planForm"
              :items="paymentFormItems"
              :span="6"
              :gutter="16"
              root-class="p-0! md:p-0!"
              ><template #paymentTable
                ><ArtTable
                  :data="paymentPlans"
                  :columns="paymentColumns"
                  :pagination="false"
                  row-key="id"
                  border
                  :max-height="380"
                  :scrollbar-always-on="false"
                  class="w-full!"
                  empty-text="暂无收款计划"
                  empty-description="点击“添加计划”设置每期应收。" /></template
              ><template
                v-for="(entry, index) in paymentPlans"
                :key="entry.id"
                #[`paymentPlans_${index}Actions`]
                ><ArtIconButton
                  icon="ri:delete-bin-line"
                  label="移除收款计划"
                  tone="danger"
                  @click="paymentPlans.splice(index, 1)" /></template
            ></ArtForm>
          </ArtSectionCard>
        </ElTabPane>

        <ElTabPane v-if="config.useDeliveryPlans" label="发货计划" name="deliveries">
          <ArtSectionCard
            title="发货计划"
            subtitle="按要货日期与运输提前期维护计划发货日期和数量。"
            :empty="!deliveryPlans.length"
            empty-title="暂无发货计划"
            empty-description="添加计划后可安排交付日期与数量。"
          >
            <template #actions>
              <ElButton type="primary" plain @click="addDeliveryPlan">
                <ArtSvgIcon icon="ri:add-line" />
                添加计划
              </ElButton>
            </template>
            <ArtTable
              v-if="kind === 'sales_order'"
              :data="deliveryPlans"
              :columns="deliveryColumns"
              :pagination="false"
              row-key="id"
              border
              :max-height="380"
              :scrollbar-always-on="false"
              class="w-full!"
              empty-text="暂无发货计划"
              empty-description="点击“添加计划”安排要货日期与发货数量。"
            /><ArtForm
              v-else
              :model-value="planForm"
              :items="deliveryFormItems"
              :span="6"
              :gutter="16"
              root-class="p-0! md:p-0!"
              ><template
                v-for="(entry, index) in deliveryPlans"
                :key="entry.id"
                #[`deliveryPlans_${index}Actions`]
                ><ArtIconButton
                  icon="ri:delete-bin-line"
                  label="移除发货计划"
                  tone="danger"
                  @click="deliveryPlans.splice(index, 1)" /></template
            ></ArtForm>
          </ArtSectionCard>
        </ElTabPane>

        <ElTabPane v-if="config.useClauses" label="合同条款" name="clauses">
          <ArtSectionCard
            title="合同条款"
            subtitle="记录双方确认的条款标题与正文。"
            :empty="!clauses.length"
            empty-title="暂无合同条款"
            empty-description="添加条款后可填写标题与正文。"
          >
            <template #actions>
              <ElButton type="primary" plain @click="addClause">
                <ArtSvgIcon icon="ri:add-line" />
                添加条款
              </ElButton>
            </template>
            <ArtForm
              :model-value="planForm"
              :items="clauseFormItems"
              :span="24"
              :gutter="16"
              root-class="p-0! md:p-0!"
              ><template
                v-for="(entry, index) in clauses"
                :key="entry.id"
                #[`clauses_${index}Actions`]
                ><ArtIconButton
                  icon="ri:delete-bin-line"
                  label="移除合同条款"
                  tone="danger"
                  @click="clauses.splice(index, 1)" /></template
            ></ArtForm>
          </ArtSectionCard>
        </ElTabPane>
        <ElTabPane v-if="kind === 'sales_contract'" name="attachments" label="合同附件">
          <ScmContractAttachments
            :key="attachmentContextKey"
            ref="contractAttachmentsRef"
            v-model="header.contractAttachments"
            :tenant-id="header.tenantId"
            :context-key="attachmentContextKey"
            :readonly="
              copyMode
                ? !hasAuth('ScmSalesContract:Copy')
                : recordId
                  ? !hasAuth('ScmSalesContract:Edit')
                  : !hasAuth('ScmSalesContract:Add')
            "
          />
        </ElTabPane>
      </ElTabs>

      <div
        class="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[var(--el-fill-color-light)] px-4 py-3 text-sm"
      >
        <span class="text-[var(--art-gray-600)]">保存时由数据库重新核算</span>
        <div v-if="kind === 'sales_quotation'" class="flex flex-wrap gap-x-5 gap-y-1 tabular-nums">
          <span
            >不含税总价 <strong>{{ formatCurrencyValue(previewTotal) }}</strong></span
          >
          <span
            >含税总价 <strong>{{ formatCurrencyValue(previewTaxInclusiveTotal) }}</strong></span
          >
          <span
            >成本总价 <strong>{{ formatCurrencyValue(previewCostTotal) }}</strong></span
          >
          <span
            >毛利 <strong>{{ formatCurrencyValue(previewGrossProfit) }}</strong></span
          >
          <span
            >毛利率 <strong>{{ previewGrossMargin.toFixed(2) }}%</strong></span
          >
        </div>
        <strong v-else class="text-lg font-semibold text-[var(--el-color-primary)]">{{
          formatCurrencyValue(previewTotal)
        }}</strong>
      </div>
    </div>
  </ArtDialog>
  <ArtDialog ref="shippingOrderPickerRef" size="xl">
    <div class="flex min-w-0 flex-col gap-3">
      <p class="text-sm text-[var(--art-gray-600)]"
        >选择一张销售订单，再勾选需要发货的明细。已添加的来源行不会重复显示。</p
      >
      <ElSelect
        v-model="selectedShippingOrderId"
        filterable
        class="w-full!"
        :disabled="Boolean(header.sourceId)"
        placeholder="搜索销售订单号"
        aria-label="选择销售订单"
        @change="loadShippingOrderLines"
      >
        <ElOption
          v-for="order in shippingOrderOptions"
          :key="order.id"
          :value="order.id"
          :label="order.documentNo"
        />
      </ElSelect>
      <ArtTable
        :data="availableShippingLines"
        :columns="shippingOrderColumns"
        :pagination="false"
        :loading="shippingOrderLoading"
        :height="Math.min(420, 88 + availableShippingLines.length * 48)"
        :scrollbar-always-on="false"
        row-key="lineId"
        border
        empty-text="暂无可选的订单明细"
        empty-description="请选择订单，或检查该订单是否还有待发货数量。"
        @selection-change="selectedShippingLines = $event"
      />
      <p class="text-xs text-[var(--art-gray-600)]"
        >已选 {{ selectedShippingLines.length }} 行 · 最多 200 行</p
      >
    </div>
  </ArtDialog>
  <ArtTableMultipleSelect
    :show-trigger="false"
    ref="loadingPickerRef"
    :api-fn="loadingPickerApi"
    :columns="loadingChoiceColumns"
    title="选单 · 待发货通知单明细"
    subtitle="按当前项目和客户核对通知余量与可用库存，选择批次后带入装车明细。"
    :dialog-width="1440"
    row-key="key"
    :label-key="(row: ScmLoadingChoice) => `${row.noticeNo} · ${row.line.materialDescription}`"
    description-key="batchNo"
    search-placeholder="搜索通知单号、物料或批次"
    empty-text="暂无可装车明细"
    empty-description="请确认通知单尚有可装车数量且对应库存可用。"
    reset-draft-on-open
    @confirm="confirmLoadingChoices"
  >
  </ArtTableMultipleSelect>
</template>

<script setup lang="tsx">
  import { ElButton } from 'element-plus'
  import { useUnitDisplayNames } from '@/hooks/core/useUnitDisplayNames'
  import { cloneDeep, omit } from 'lodash-es'
  import dayjs from 'dayjs'
  import {
    ElCheckbox,
    ElDatePicker,
    ElInput,
    ElInputNumber,
    ElMessage,
    ElOption,
    ElSelect,
    type FormRules
  } from 'element-plus'
  import ArtDialog from '@/components/core/dialogs/art-dialog/index.vue'
  import type { ArtDialogExpose } from '@/components/core/dialogs/art-dialog/types'
  import ArtForm, { type FormItem } from '@/components/core/forms/art-form/index.vue'
  import ArtTableMultipleSelect from '@/components/core/forms/art-data-select/table-multiple.vue'
  import type { EmployeeIntegrationItem } from '@/api/integration/employees'
  import type {
    ArtDataSelectExpose,
    DataSelectFetchParams,
    DataSelectModelValue,
    DataSelectColumn
  } from '@/components/core/forms/art-data-select/types'
  import ArtSectionCard from '@/components/core/surfaces/art-section-card/index.vue'
  import ArtEntitySummary from '@/components/core/surfaces/art-entity-summary/index.vue'
  import { useAuth } from '@/hooks/core/useAuth'
  import ScmContractAttachments from '../../../components/scm-contract-attachments.vue'
  import ArtAsyncState from '@/components/core/feedback/art-async-state/index.vue'
  import ArtTable, { type ArtTableExpose } from '@/components/core/tables/art-table/index.vue'
  import ArtIconButton from '@/components/core/widget/art-icon-button/index.vue'
  import type { ColumnOption } from '@/types'
  import { useTenantScopeFormPolicy } from '@/hooks/core/useTenantScopeFormPolicy'
  import { useUserStore } from '@/store/modules/user'
  import { formatCurrencyValue } from '@/utils/ui/format'
  import {
    createScmSalesDocument,
    fetchQuoteExpenseOptions,
    fetchScmCustomerOptions,
    fetchScmDocumentTypeOptions,
    fetchScmEngineeringReferenceOptions,
    fetchScmMaterialOptions,
    fetchScmLoadingChoices,
    fetchScmProjectOptions,
    fetchScmRemainingSourceLines,
    fetchScmSalespersonOptions,
    fetchScmSourceOptions,
    updateScmSalesDocument,
    type ScmContractClause,
    type ScmContractAttachment,
    type ScmCustomerOption,
    type ScmDeliveryPlan,
    type ScmDocumentDetails,
    type ScmDocumentFee,
    type ScmDocumentKind,
    type ScmDocumentLine,
    type ScmDocumentTypeOption,
    type ScmEngineeringReferenceOptions,
    type ScmMaterialOption,
    type ScmLoadingChoice,
    type ScmPaymentPlan,
    type ScmProjectOption,
    type ScmQuoteExpense,
    type ScmSalesDocument,
    type ScmSalesDocumentWrite
  } from '@scm/api'
  import { scmDocumentConfigs } from '../document-config'
  import {
    calculateContractLine,
    calculateQuotationLine,
    contractAuxiliaryQuantity
  } from '../quotation-pricing'
  import { buildLoadingLines } from '../loading-selection'
  import QuotationLineTable from './quotation-line-table.vue'

  import '../quotation-summary-table.css'

  defineOptions({ name: 'ScmDocumentDialog' })
  const { loadUnitDisplayNames, unitDisplayName } = useUnitDisplayNames()
  const { hasAuth } = useAuth()

  interface OpenOptions {
    kind: ScmDocumentKind
    record?: ScmSalesDocument
    copy?: boolean
    tenantOptions: Array<{ label: string; value: string }>
    effectiveTenantId: string | null
    initialSource?: ScmSalesDocument
    sourceLines?: ScmDocumentLine[]
  }

  interface HeaderModel {
    tenantId: string
    documentNo: string
    documentTypeId: string
    projectId: string
    customerId: string
    sourceId: string
    documentDate: string
    deliveryDate: string
    currency: string
    remark: string
    contractAttachments: ScmContractAttachment[]
  }

  const emit = defineEmits<{ success: [mode: 'add' | 'edit'] }>()
  const { shouldExposeTenantField, defaultWriteTenantId } = useTenantScopeFormPolicy()
  const userStore = useUserStore()
  const dialogRef = ref<ArtDialogExpose<OpenOptions>>()
  const shippingOrderPickerRef = ref<ArtDialogExpose>()
  const headerFormRef = ref<{ validate: () => Promise<boolean>; clearValidate: () => void }>()
  const contractFormRef = ref<{ validate: () => Promise<boolean>; clearValidate: () => void }>()
  const contractAttachmentsRef = ref<{ hasPendingUpload: () => boolean }>()
  const detailsFormRef = ref<{ validate: () => Promise<boolean>; clearValidate: () => void }>()
  const quotationLineTableRef = ref<{
    validate: () => Promise<boolean>
    openSourcePicker: (kind: 'sales_quotation' | 'sales_contract') => Promise<void>
  }>()
  const feeTableRef = ref<ArtTableExpose>()
  const kind = ref<ScmDocumentKind>('sales_quotation')
  const config = computed(() => scmDocumentConfigs[kind.value])
  const recordId = ref<string>()
  const copyMode = ref(false)
  const tenantOptions = ref<OpenOptions['tenantOptions']>([])
  const projectOptions = ref<ScmProjectOption[]>([])
  const quotationDocuments = ref<ScmSalesDocument[]>([])
  const contractDocuments = ref<ScmSalesDocument[]>([])
  const selectedSalesperson = ref<EmployeeIntegrationItem[]>([])
  const projectPickerColumns: DataSelectColumn[] = [
    { prop: 'projectCode', label: '项目编码', width: 150 },
    { prop: 'projectName', label: '项目名称', minWidth: 230 },
    {
      prop: 'customerGroupName',
      label: '客户分组',
      minWidth: 140,
      formatter: (row) => (row as ScmProjectOption).customer?.customerGroup?.name ?? '—'
    },
    {
      prop: 'customerName',
      label: '客户',
      minWidth: 170,
      formatter: (row) => (row as ScmProjectOption).customer?.customerName ?? '—'
    }
  ]
  const projectPickerLabel = (row: { projectCode?: string; projectName?: string }): string =>
    `${row.projectName ?? ''} · ${row.projectCode ?? ''}`
  const customerOptions = ref<ScmCustomerOption[]>([])
  const contractQuantityOptional = computed(
    () =>
      kind.value === 'sales_contract' &&
      ['框架销售合同', '价值合同'].includes(
        documentTypeOptions.value.find((type) => type.id === header.value.documentTypeId)
          ?.documentTypeName ?? ''
      )
  )
  const materialOptions = ref<ScmMaterialOption[]>([])
  const expenseOptions = ref<ScmQuoteExpense[]>([])
  const documentTypeOptions = ref<ScmDocumentTypeOption[]>([])
  const sourceOptions = ref<ScmSalesDocument[]>([])
  const engineeringReferences = reactive<ScmEngineeringReferenceOptions>({
    categories: [],
    materialTypes: [],
    units: [],
    codeRules: []
  })
  const referencesLoading = ref(false)
  const referenceError = ref<Error | null>(null)
  const activeTab = ref('lines')
  const attachmentContextKey = ref(crypto.randomUUID())
  let loadingSeed: { source: ScmSalesDocument; lineIds?: string[] } | undefined
  let preparing = false
  let referenceRevision = 0
  let openRevision = 0
  const route = useRoute()
  function invalidateOpen(): void {
    loadingSeed = undefined
    openRevision += 1
    referenceRevision += 1
    referencesLoading.value = false
    referenceError.value = null
  }
  watch(() => route.fullPath, invalidateOpen)

  function initialHeader(): HeaderModel {
    return {
      tenantId: '',
      documentNo: '',
      documentTypeId: '',
      projectId: '',
      customerId: '',
      sourceId: '',
      documentDate: dayjs().format('YYYY-MM-DD'),
      deliveryDate: '',
      currency: 'CNY',
      remark: '',
      contractAttachments: []
    }
  }

  const header = ref<HeaderModel>(initialHeader())
  const details = ref<ScmDocumentDetails>({})
  const contractFormModel = computed(() => ({ header: header.value, details: details.value }))
  const salesContractSummary = computed(() => {
    const project = projectOptions.value.find((item) => item.id === header.value.projectId)
    const customer = customerOptions.value.find((item) => item.id === header.value.customerId)
    return `${project?.projectName || '未选择项目'} · ${customer?.customerName || '未选择客户'}`
  })
  const lines = ref<ScmDocumentLine[]>([])
  const selectedShippingOrderId = ref('')
  interface ShippingLineChoice extends ScmDocumentLine {
    salesQuantity: number
    availableQuantity: number
  }
  const availableShippingLines = ref<ShippingLineChoice[]>([])
  const selectedShippingLines = ref<ShippingLineChoice[]>([])
  const shippingOrderLoading = ref(false)
  let shippingOrderRevision = 0
  const shippingOrderOptions = computed(() =>
    sourceOptions.value.filter(
      (order) =>
        (!header.value.projectId || order.projectId === header.value.projectId) &&
        (!header.value.customerId || order.customerId === header.value.customerId)
    )
  )
  const shippingOrderColumns: ColumnOption<ShippingLineChoice>[] = [
    { type: 'selection', width: 48 },
    { prop: 'lineNo', label: '行号', width: 78 },
    { prop: 'materialCode', label: '物料编码', minWidth: 150 },
    { prop: 'materialDescription', label: '物料描述', minWidth: 220, showOverflowTooltip: true },
    { prop: 'salesQuantity', label: '销单数量', width: 110, align: 'right' },
    { prop: 'availableQuantity', label: '可发货数量', width: 120, align: 'right' },
    { prop: 'baseUnit', label: '基本单位', width: 100 }
  ]
  const loadingPickerRef = ref<ArtDataSelectExpose>()
  const loadingChoiceColumns: DataSelectColumn<ScmLoadingChoice>[] = [
    { prop: 'noticeNo', label: '发货通知单号', minWidth: 170 },
    { prop: 'noticeLineNo', label: '行号', width: 75 },
    { prop: 'line.materialCode', label: '物料编码', minWidth: 145 },
    {
      prop: 'line.materialDescription',
      label: '物料描述',
      minWidth: 200
    },
    { prop: 'line.baseUnit', label: '基本单位', width: 95 },
    { prop: 'noticeQuantity', label: '通知单数量', width: 110, align: 'right' },
    { prop: 'availableQuantity', label: '可装车数量', width: 110, align: 'right' },
    { prop: 'loadedQuantity', label: '已装车数量', width: 110, align: 'right' },
    { prop: 'availableStock', label: '可用库存', width: 100, align: 'right' },
    { prop: 'warehouseName', label: '仓库', minWidth: 130 },
    { prop: 'zoneName', label: '库区', minWidth: 110 },
    { prop: 'binName', label: '库位', minWidth: 110 },
    { prop: 'batchNo', label: '批次', minWidth: 110 },
    { prop: 'packNo', label: '包号', minWidth: 130, formatter: (row) => row.packNo || '—' },
    { prop: 'line.sourceDocumentNo', label: '销售订单号', minWidth: 150 },
    { prop: 'line.sourceLineNo', label: '销单行号', width: 90 }
  ]
  const fees = ref<ScmDocumentFee[]>([])
  const paymentPlans = ref<ScmPaymentPlan[]>([])
  const deliveryPlans = ref<ScmDeliveryPlan[]>([])
  const clauses = ref<ScmContractClause[]>([])

  const discountOptions = computed(() =>
    (userStore.getDictMap?.scmDiscountMode ?? [])
      .filter(
        (item) =>
          (kind.value !== 'sales_contract' && kind.value !== 'sales_order') ||
          ['none', 'percentage'].includes(String(item.value))
      )
      .map((item) => ({
        label: item.label ?? item.name,
        value: String(item.value)
      }))
  )
  const materialSourceOptions = computed(() =>
    (userStore.getDictMap?.mdmMaterialSource ?? []).map((item) => ({
      label: item.label ?? item.name,
      value: String(item.value)
    }))
  )
  const taxRateOptions = computed(() =>
    (userStore.getDictMap?.scmTaxRate ?? []).map((item) => ({
      label: item.label ?? item.name,
      value: String(item.value)
    }))
  )
  const clauseOptions = computed(() =>
    (userStore.getDictMap?.commonContractClauseType ?? []).map((item) => ({
      label: item.label ?? item.name,
      value: String(item.value)
    }))
  )
  function lineAmount(line: ScmDocumentLine): number {
    return (
      kind.value === 'sales_contract' || kind.value === 'sales_order'
        ? calculateContractLine(line)
        : calculateQuotationLine(line)
    ).amount
  }

  function lineTax(line: ScmDocumentLine): number {
    return (
      kind.value === 'sales_contract' || kind.value === 'sales_order'
        ? calculateContractLine(line)
        : calculateQuotationLine(line)
    ).tax
  }

  const contractCalculatedTotal = computed(() => {
    const subtotal = lines.value.reduce((sum, line) => sum + lineAmount(line), 0)
    const feeTotal = fees.value.reduce((sum, fee) => sum + Number(fee.amount || 0), 0)
    const projectExtras =
      kind.value === 'project_quotation'
        ? Number(details.value.packageFee || 0) + Number(details.value.transportFee || 0)
        : 0
    const taxTotal =
      kind.value === 'sales_contract' || kind.value === 'sales_order'
        ? lines.value.reduce((sum, line) => sum + lineTax(line), 0)
        : 0
    return subtotal + taxTotal + feeTotal + projectExtras
  })
  const previewTotal = computed(() =>
    kind.value === 'sales_contract' && details.value.contractTotalAmount !== undefined
      ? details.value.contractTotalAmount
      : contractCalculatedTotal.value
  )
  const previewTaxInclusiveTotal = computed(() =>
    lines.value.reduce((sum, line) => sum + calculateQuotationLine(line).total, 0)
  )
  const previewCostTotal = computed(
    () =>
      lines.value.reduce(
        (sum, line) => sum + Number(line.quantity) * Number(line.costUnitPrice || 0),
        0
      ) + fees.value.reduce((sum, fee) => sum + Number(fee.cost || 0), 0)
  )
  const previewGrossProfit = computed(() => previewTotal.value - previewCostTotal.value)
  const previewGrossMargin = computed(() =>
    previewTotal.value ? (previewGrossProfit.value / previewTotal.value) * 100 : 0
  )

  const headerRules = computed<FormRules<HeaderModel>>(() => ({
    tenantId: [{ required: true, message: '请选择所属租户', trigger: 'change' }],
    documentNo:
      ['sales_quotation', 'sales_contract', 'sales_order', 'shipping_notice', 'loading'].includes(
        kind.value
      ) && !recordId.value
        ? []
        : [
            { required: true, message: '请输入单据编号', trigger: 'blur' },
            { min: 2, max: 60, message: '单据编号长度应为 2–60 个字符', trigger: 'blur' }
          ],
    projectId: [
      {
        validator: (_rule, value, callback) => {
          if (value || (kind.value === 'project_quotation' && header.value.sourceId)) callback()
          else callback(new Error('请选择项目'))
        },
        trigger: 'change'
      }
    ],
    customerId: [{ required: true, message: '请选择客户', trigger: 'change' }],
    documentTypeId:
      kind.value === 'sales_order'
        ? []
        : [{ required: true, message: '请选择单据类型', trigger: 'change' }],
    documentDate: [{ required: true, message: '请选择单据日期', trigger: 'change' }]
  }))

  const detailRules = computed<FormRules<ScmDocumentDetails>>(() => {
    const rules: FormRules<ScmDocumentDetails> = {}
    for (const field of activeDetailFields.value) {
      if (field.required)
        rules[field.key] = [{ required: true, message: `请填写${field.label}`, trigger: 'blur' }]
    }
    if (kind.value === 'sales_quotation') {
      rules.quotationQuantity = [
        {
          validator: (_rule, value, callback) =>
            Number(value) > 0 ? callback() : callback(new Error('数量必须大于 0')),
          trigger: 'change'
        }
      ]
    }
    return rules
  })

  const activeDetailFields = computed(() => config.value.fields)

  const baseHeaderItems = computed<FormItem[]>(() => [
    ...(shouldExposeTenantField.value
      ? [
          ...(kind.value === 'sales_contract'
            ? []
            : [{ label: '数据归属', key: 'tenantSection', type: 'divider', span: 24 } as FormItem]),
          {
            label: '所属租户',
            key: 'tenantId',
            type: 'select',
            span: 24,
            props: {
              options: tenantOptions.value,
              filterable: true,
              disabled: Boolean(recordId.value),
              placeholder: '选择单据所属租户'
            }
          } as FormItem
        ]
      : []),
    ...(kind.value === 'sales_contract'
      ? []
      : [{ label: '单据', key: 'documentSection', type: 'divider', span: 24 } as FormItem]),
    {
      label: config.value.numberLabel,
      key: 'documentNo',
      type: 'input',
      props: {
        maxlength: 60,
        disabled: [
          'sales_quotation',
          'sales_contract',
          'sales_order',
          'shipping_notice',
          'loading'
        ].includes(kind.value),
        placeholder: [
          'sales_quotation',
          'sales_contract',
          'sales_order',
          'shipping_notice',
          'loading'
        ].includes(kind.value)
          ? '保存后按月度编号规则自动生成'
          : undefined
      }
    },
    {
      label: '单据类型',
      key: 'documentTypeId',
      type: 'select',
      props: {
        options: documentTypeOptions.value.map((item) => ({
          label: item.documentTypeName,
          value: item.id
        })),
        filterable: true,
        clearable: true,
        loading: referencesLoading.value,
        noDataText:
          kind.value === 'shipping_notice'
            ? '请先在 MDM 单据类型中配置发货通知单类型'
            : '暂无可用单据类型',
        placeholder: '按 MDM 单据类型配置参选'
      }
    },
    {
      label: '项目名称',
      key: 'projectId',
      type: 'dataSelect',
      props: {
        ...{
          options: projectOptions.value.map((item) => ({
            label: `${item.projectName}（${item.projectCode}）`,
            value: item.id
          })),
          filterable: true,
          loading: referencesLoading.value,
          disabled: !header.value.tenantId || Boolean(header.value.sourceId),
          clearable: !config.value.projectRequired,
          placeholder: config.value.projectRequired
            ? '请选择项目'
            : '选择既有项目，或在下方自动创建'
        },
        mode: 'table',
        multiple: false,
        modelValue: header.value.projectId,
        'onUpdate:modelValue': (value: typeof header.value.projectId) => {
          header.value.projectId = value
        },
        data: projectOptions.value,
        columns: projectPickerColumns,
        rowKey: 'id',
        labelKey: projectPickerLabel,
        title: '参选项目',
        searchPlaceholder: '搜索项目编号或名称',
        disabled:
          !header.value.tenantId || (kind.value !== 'loading' && Boolean(header.value.sourceId)),
        emptyText: '暂无可选项目',
        emptyDescription: '请先在 MDM 项目列表维护项目。',
        dialogWidth: 'xl',
        showSelectedPanel: false,
        showPagination: false
      }
    },
    {
      label: '客户全称',
      key: 'customerId',
      type: 'select',
      props: {
        options: customerOptions.value.map((item) => ({
          label: `${item.customerName}（${item.customerCode}）`,
          value: item.id
        })),
        filterable: true,
        loading: referencesLoading.value,
        disabled: !header.value.tenantId || Boolean(header.value.sourceId),
        placeholder: '优先从项目带入，可手动选择'
      }
    },
    ...(config.value.sourceKind &&
    kind.value !== 'sales_order' &&
    kind.value !== 'shipping_notice' &&
    kind.value !== 'loading'
      ? [
          {
            label: config.value.sourceLabel || '来源单据',
            key: 'sourceId',
            type: 'select',
            span: 12,
            props: {
              options: sourceOptions.value.map((item) => ({
                label: `${item.documentNo} · ${projectOptions.value.find((project) => project.id === item.projectId)?.projectName || '未关联项目'}`,
                value: item.id
              })),
              filterable: true,
              clearable: !config.value.sourceRequired,
              loading: referencesLoading.value,
              disabled: !header.value.tenantId,
              noDataText:
                config.value.sourceKind === 'sales_order'
                  ? '当前租户暂无已审核或履约中的销售订单'
                  : '当前租户暂无可用来源单据，请核对租户和单据状态',
              placeholder: config.value.sourceRequired ? '请选择来源单据' : '可从已存在的单据带入'
            }
          } as FormItem
        ]
      : []),
    {
      label: '单据日期',
      key: 'documentDate',
      type: 'date',
      props: { type: 'date', valueFormat: 'YYYY-MM-DD', class: 'w-full!' }
    },
    {
      label: '交货日期',
      key: 'deliveryDate',
      type: 'date',
      props: { type: 'date', valueFormat: 'YYYY-MM-DD', class: 'w-full!', clearable: true }
    },
    {
      label: '币种',
      key: 'currency',
      type: 'select',
      props: {
        options: userStore.getDictMap?.mdmCurrency ?? [],
        filterable: true,
        placeholder: '选择币种'
      }
    },
    {
      label: '备注',
      key: 'remark',
      type: 'input',
      span: 24,
      props: { type: 'textarea', rows: 2, maxlength: 500, showWordLimit: true }
    }
  ])

  const planForm = reactive({ details, paymentPlans, deliveryPlans, clauses })
  const paymentFormItems = computed<FormItem[]>(() => {
    const tableMode = kind.value === 'sales_contract' || kind.value === 'sales_order'
    return [
      ...(tableMode
        ? [
            {
              key: 'details.paymentPlanMode',
              label: '收款计划方式',
              type: 'switch',
              span: 24,
              description: tableMode
                ? details.value.paymentPlanMode === 'ratio'
                  ? '填写应收比例，自动计算金额'
                  : '填写应收金额，自动计算比例'
                : '',
              props: {
                activeValue: 'ratio',
                inactiveValue: 'amount',
                'aria-label': '按比例编制收款计划'
              }
            }
          ]
        : []),
      ...(tableMode
        ? [{ key: 'paymentTable', label: '', type: 'paymentPlanTable', span: 24 }]
        : paymentPlans.value.flatMap((_plan, index): FormItem[] => [
            {
              key: `paymentPlans_${index}`,
              label: `第 ${index + 1} 期收款`,
              type: 'divider',
              span: 24
            },
            {
              key: `paymentPlans.${index}.dueDate`,
              label: '到期日期',
              type: 'date',
              props: { type: 'date', valueFormat: 'YYYY-MM-DD', class: 'w-full!' }
            },
            {
              key: `paymentPlans.${index}.ratio`,
              label: '应收比例（%）',
              type: 'number',
              props: {
                min: 0,
                max: 100,
                precision: 2,
                controls: false,
                disabled: details.value.paymentPlanMode === 'amount',
                class: 'w-full!',
                'aria-label': '应收比例'
              }
            },
            {
              key: `paymentPlans.${index}.amount`,
              label: '应收金额（元）',
              type: 'number',
              props: {
                min: 0,
                precision: 2,
                controls: false,
                disabled: details.value.paymentPlanMode === 'ratio',
                class: 'w-full!',
                'aria-label': '应收金额'
              }
            },
            {
              key: `paymentPlans.${index}.excessRatio`,
              label: '预收允超比例（%）',
              type: 'number',
              props: { min: 0, max: 100, precision: 2, controls: false, class: 'w-full!' }
            },
            { key: `paymentPlans.${index}.isAdvance`, label: '是否预收', type: 'switch' },
            {
              key: `paymentPlans.${index}.remark`,
              label: '计划备注',
              type: 'input',
              span: 24,
              props: { maxlength: 300 }
            }
          ]))
    ]
  })
  const deliveryFormItems = computed<FormItem[]>(() =>
    deliveryPlans.value.flatMap((_plan, index): FormItem[] => [
      { key: `deliveryPlans_${index}`, label: `第 ${index + 1} 期发货`, type: 'divider', span: 24 },

      {
        key: `deliveryPlans.${index}.location`,
        label: '收货地点',
        type: 'input',
        props: { maxlength: 100 }
      },
      {
        key: `deliveryPlans.${index}.address`,
        label: '收货地址',
        type: 'input',
        span: 12,
        props: { maxlength: 200 }
      },
      {
        key: `deliveryPlans.${index}.needDate`,
        label: '要货日期',
        type: 'date',
        props: { type: 'date', valueFormat: 'YYYY-MM-DD', class: 'w-full!' }
      },
      {
        key: `deliveryPlans.${index}.leadDays`,
        label: '运输提前期（天）',
        type: 'number',
        props: { min: 0, max: 365, controls: false, class: 'w-full!' }
      },
      {
        key: `deliveryPlans.${index}.plannedDate`,
        label: '计划发货日期',
        type: 'date',
        props: { type: 'date', valueFormat: 'YYYY-MM-DD', class: 'w-full!' }
      },
      {
        key: `deliveryPlans.${index}.quantity`,
        label: '计划数量',
        type: 'number',
        props: { min: 0.001, precision: 3, controls: false, class: 'w-full!' }
      }
    ])
  )
  const clauseFormItems = computed<FormItem[]>(() =>
    clauses.value.flatMap((_clause, index): FormItem[] => [
      { key: `clauses_${index}`, label: `第 ${index + 1} 条`, type: 'divider', span: 24 },
      {
        key: `clauses.${index}.title`,
        label: '合同条款',
        type: 'select',
        options: clauseOptions.value,
        props: {
          filterable: true,
          clearable: false,
          placeholder: '参选合同条款',
          'aria-label': `第 ${index + 1} 条合同条款`
        }
      },
      {
        key: `clauses.${index}.content`,
        label: '条款内容',
        type: 'textarea',
        props: { rows: 3, maxlength: 4000, showWordLimit: false, placeholder: '条款内容' }
      }
    ])
  )

  const detailItems = computed<FormItem[]>(() => [
    ...(config.value.usePaymentPlans &&
    kind.value !== 'sales_contract' &&
    kind.value !== 'sales_order'
      ? [
          {
            label: '收款计划方式',
            key: 'paymentPlanMode',
            type: 'select',
            span: 12,
            props: {
              options: userStore.getDictMap?.scmPaymentPlanMode ?? [],
              placeholder: '按比例或按金额'
            }
          } as FormItem
        ]
      : []),
    ...activeDetailFields.value.map((field): FormItem => ({
      label: field.label,
      key: field.key,
      type:
        field.key === 'contractTotalAmount'
          ? 'number'
          : field.key === 'salespersonId'
            ? 'employeeSelect'
            : field.type,
      description:
        field.key === 'contractTotalAmount' && details.value.contractTotalAmount !== undefined
          ? () => (
              <ElButton
                text
                type="primary"
                onClick={() => {
                  details.value.contractTotalAmount = undefined
                }}
              >
                按明细重算
              </ElButton>
            )
          : undefined,
      span: field.span ?? 12,
      props:
        field.key === 'contractTotalAmount'
          ? {
              modelValue: details.value.contractTotalAmount ?? contractCalculatedTotal.value,
              min: 0,
              precision: 2,
              controls: false,
              class: 'w-full!',
              'aria-label': '合同总金额',
              'onUpdate:modelValue': (amount: number | null | undefined) => {
                details.value.contractTotalAmount = amount ?? undefined
              }
            }
          : field.key === 'salespersonId'
            ? {
                tenantId: header.value.tenantId,
                apiFn: fetchScmSalespersonOptions,
                displayFields: ['organization', 'jobTitle', 'employmentStatus'],
                placeholder: '从员工花名册参选销售员',
                selectedData: selectedSalesperson.value,
                'onUpdate:selectedData': (rows: EmployeeIntegrationItem[]) => {
                  selectedSalesperson.value = rows
                },
                onChange: updateSalesperson
              }
            : field.key === 'productName' && kind.value === 'sales_quotation'
              ? {
                  options: materialOptions.value.map((item) => ({
                    label: item.materialDescription,
                    value: item.materialDescription
                  })),
                  filterable: true,
                  clearable: true,
                  placeholder: '从物料描述中选填产品名称'
                }
              : field.type === 'date'
                ? {
                    type: 'date',
                    valueFormat: 'YYYY-MM-DD',
                    class: 'w-full!',
                    clearable: true,
                    disabled: kind.value === 'project_quotation'
                  }
                : field.type === 'number'
                  ? {
                      min: 0,
                      precision: 2,
                      controls: false,
                      class: 'w-full!',
                      disabled: kind.value === 'project_quotation'
                    }
                  : field.type === 'select'
                    ? {
                        options: userStore.getDictMap?.[field.dictionary || ''] ?? [],
                        clearable: true,
                        disabled:
                          kind.value === 'project_quotation' || field.key === 'salesDepartment'
                      }
                    : {
                        maxlength: field.span === 24 ? 500 : 120,
                        disabled: kind.value === 'project_quotation'
                      }
    }))
  ])
  const contractBaseItems = computed<FormItem[]>(() => {
    const headerFields = baseHeaderItems.value.filter((item) => item.type !== 'divider')
    const remark = headerFields.find((item) => item.key === 'remark')
    return [
      ...headerFields
        .filter((item) => item.key !== 'remark')
        .map((item) => ({
          ...item,
          key: `header.${item.key}`,
          span: item.span === 24 ? 24 : 8
        })),
      ...detailItems.value.map((item) => ({
        ...item,
        key: `details.${item.key}`,
        span: item.span === 24 ? 24 : 8
      })),
      ...(remark ? [{ ...remark, key: 'header.remark', span: 24 }] : [])
    ]
  })
  const contractRules = computed<FormRules>(() => {
    const rules: FormRules = {}
    for (const [key, value] of Object.entries(headerRules.value)) rules[`header.${key}`] = value
    for (const [key, value] of Object.entries(detailRules.value)) rules[`details.${key}`] = value
    return rules
  })

  async function loadReferences(tenantId: string): Promise<void> {
    const revision = ++referenceRevision
    referenceError.value = null
    projectOptions.value = []
    customerOptions.value = []
    materialOptions.value = []
    expenseOptions.value = []
    documentTypeOptions.value = []
    sourceOptions.value = []
    quotationDocuments.value = []
    contractDocuments.value = []
    Object.assign(engineeringReferences, {
      categories: [],
      materialTypes: [],
      units: [],
      codeRules: []
    })
    if (!tenantId) {
      referencesLoading.value = false
      referenceError.value = new Error('请选择单据所属租户后重试')
      return
    }
    referencesLoading.value = true
    const timeout = window.setTimeout(() => {
      if (revision !== referenceRevision) return
      referenceRevision += 1
      referencesLoading.value = false
      referenceError.value = new Error('关联资料读取超时，请重新加载；已填写内容会保留')
    }, 30_000)
    try {
      await Promise.all(
        [
          'scmDiscountMode',
          'scmPaymentPlanMode',
          'scmPaymentType',
          'scmTransportMode',
          'mdmCurrency',
          'scmTaxRate',
          'commonContractClauseType'
        ].map((code) => userStore.ensureDictLoaded(code))
      )
      if (revision !== referenceRevision) return
      await loadUnitDisplayNames([tenantId])
      if (revision !== referenceRevision) return
      const [
        projects,
        customers,
        materials,
        expenses,
        types,
        sources,
        engineering,
        quotations,
        contracts
      ] = await Promise.all([
        fetchScmProjectOptions(tenantId),
        fetchScmCustomerOptions(tenantId),
        fetchScmMaterialOptions(tenantId),
        fetchQuoteExpenseOptions({ tenantId }),
        fetchScmDocumentTypeOptions(tenantId, config.value.menuName),
        config.value.sourceKind
          ? fetchScmSourceOptions(config.value.sourceKind, tenantId)
          : Promise.resolve(null),
        kind.value === 'sales_quotation'
          ? fetchScmEngineeringReferenceOptions(tenantId)
          : Promise.resolve(null),
        kind.value === 'sales_contract' || kind.value === 'sales_order'
          ? fetchScmSourceOptions('sales_quotation', tenantId)
          : Promise.resolve(null),
        kind.value === 'sales_order'
          ? fetchScmSourceOptions('sales_contract', tenantId)
          : Promise.resolve(null)
      ])
      if (revision !== referenceRevision) return
      for (const result of [
        projects,
        customers,
        materials,
        expenses,
        types,
        sources,
        engineering,
        quotations,
        contracts
      ]) {
        if (result && 'error' in result && result.error) throw result.error
      }
      projectOptions.value = projects.data ?? []
      customerOptions.value = customers.data ?? []
      materialOptions.value = materials.data ?? []
      expenseOptions.value = expenses.data ?? []
      documentTypeOptions.value = types.data ?? []
      if (!recordId.value && !header.value.documentTypeId) {
        header.value.documentTypeId =
          documentTypeOptions.value.find((item) => item.isDefault)?.id ?? ''
      }
      quotationDocuments.value = (quotations?.data ?? []).filter(
        (item) => item.status === 'effective'
      )
      contractDocuments.value = (contracts?.data ?? []).filter(
        (item) => item.status === 'effective'
      )
      sourceOptions.value = (sources?.data ?? []).filter((item) => {
        if (config.value.sourceKind === 'shipping_notice')
          return ['shipped', 'completed'].includes(item.status)
        if (config.value.sourceKind === 'sales_order')
          return ['approved', 'fulfilling'].includes(item.status)
        if (config.value.sourceKind === 'sales_contract') return item.status === 'effective'
        if (config.value.sourceKind === 'project_quotation') return item.status === 'effective'
        if (kind.value === 'project_quotation') return item.status === 'effective'
        return item.status === 'effective'
      })
      if (engineering?.data) Object.assign(engineeringReferences, engineering.data)
      if (loadingSeed && kind.value === 'loading') {
        const seed = loadingSeed
        const choices = await fetchScmLoadingChoices(
          header.value.tenantId,
          header.value.projectId,
          header.value.customerId
        )
        if (revision !== referenceRevision) return
        lines.value = buildLoadingLines(
          choices.filter(
            (choice) =>
              choice.noticeId === seed.source.id &&
              (!seed.lineIds || seed.lineIds.includes(choice.noticeLineId))
          ),
          [],
          () => crypto.randomUUID()
        )
        loadingSeed = undefined
        if (!lines.value.length)
          ElMessage.warning('该通知单暂无可装车数量或可用库存，请通过选单核对')
      }
    } catch (cause) {
      if (revision === referenceRevision)
        referenceError.value = new Error('关联主数据加载失败，请重试；已填写内容会保留', { cause })
    } finally {
      window.clearTimeout(timeout)
      if (revision === referenceRevision) referencesLoading.value = false
    }
  }

  function addFee(): void {
    const next = expenseOptions.value.find(
      (expense) => !fees.value.some((item) => item.expenseId === expense.id)
    )
    if (next) fees.value.push({ expenseId: next.id, amount: 0, cost: 0 })
  }

  const feeColumns = computed<ColumnOption<ScmDocumentFee>[]>(() => [
    {
      prop: 'expenseId',
      label: '费用',
      minWidth: 190,
      required: true,
      requiredMessage: ({ rowIndex }) => `第 ${rowIndex + 1} 项费用未选择费用类型`,
      formatter: (row) => (
        <ElSelect
          v-model={row.expenseId}
          filterable
          style={{ width: '100%' }}
          aria-label="费用类型"
        >
          {expenseOptions.value.map((expense) => (
            <ElOption
              key={expense.id}
              label={expense.expenseName}
              value={expense.id}
              disabled={fees.value.some((item) => item !== row && item.expenseId === expense.id)}
            />
          ))}
        </ElSelect>
      )
    },
    {
      prop: 'amount',
      label: '金额（元）',
      width: 155,
      align: 'right',
      required: true,
      rules: {
        validator: ({ value }) => Number.isFinite(Number(value)) && Number(value) >= 0,
        message: '费用金额不能小于 0'
      },
      formatter: (row) => (
        <ElInputNumber
          v-model={row.amount}
          min={0}
          precision={2}
          controls={false}
          class="w-full!"
          aria-label="费用金额"
        />
      )
    },
    {
      prop: 'cost',
      label: '成本（元）',
      width: 155,
      align: 'right',
      required: true,
      rules: {
        validator: ({ value }) => Number.isFinite(Number(value)) && Number(value) >= 0,
        message: '费用成本不能小于 0'
      },
      formatter: (row) => (
        <ElInputNumber
          v-model={row.cost}
          min={0}
          precision={2}
          controls={false}
          class="w-full!"
          aria-label="费用成本"
        />
      )
    },
    {
      prop: 'remark',
      label: '备注',
      minWidth: 170,
      formatter: (row) => (
        <ElInput v-model={row.remark} maxlength={300} placeholder="备注" aria-label="费用备注" />
      )
    },
    {
      prop: 'operation',
      label: '操作',
      width: 68,
      align: 'center',
      formatter: (row) => (
        <ArtIconButton
          icon="ri:delete-bin-line"
          label="移除费用"
          tone="danger"
          onClick={() => {
            const index = fees.value.indexOf(row)
            if (index >= 0) fees.value.splice(index, 1)
          }}
        />
      )
    }
  ])

  function feeSummaryMethod({ columns }: { columns: Array<{ property?: string }> }): string[] {
    return columns.map((column, index) => {
      if (index === 0) return '合计'
      if (column.property === 'amount')
        return formatCurrencyValue(
          fees.value.reduce((sum, fee) => sum + Number(fee.amount || 0), 0)
        )
      if (column.property === 'cost')
        return formatCurrencyValue(fees.value.reduce((sum, fee) => sum + Number(fee.cost || 0), 0))
      return ''
    })
  }

  function addPaymentPlan(): void {
    paymentPlans.value.push({
      id: crypto.randomUUID(),
      paymentTypes: [],
      isAdvance: false,
      dueDate: '',
      ratio: 0,
      amount: 0,
      excessRatio: 0
    })
  }

  const paymentColumns = computed<ColumnOption<ScmPaymentPlan>[]>(() => [
    {
      prop: 'id',
      label: '#',
      width: 52,
      align: 'center',
      formatter: (row) => String(paymentPlans.value.indexOf(row) + 1)
    },
    {
      prop: 'isAdvance',
      label: '是否预收',
      width: 100,
      align: 'center',
      formatter: (row) => <ElCheckbox v-model={row.isAdvance} aria-label="是否预收" />
    },
    {
      prop: 'paymentTypes',
      label: '收/付款类型',
      minWidth: 215,
      formatter: (row) => (
        <ElSelect
          v-model={row.paymentTypes}
          multiple
          collapseTags
          collapseTagsTooltip
          clearable
          placeholder="选择收/付款类型"
          class="w-full!"
          aria-label="收付款类型"
        >
          {(userStore.getDictMap?.scmPaymentType ?? []).map((option) => (
            <ElOption key={option.value} label={option.label} value={option.value} />
          ))}
        </ElSelect>
      )
    },
    {
      prop: 'dueDate',
      label: '到期日',
      width: 175,
      formatter: (row) => (
        <ElDatePicker
          v-model={row.dueDate}
          type="date"
          valueFormat="YYYY-MM-DD"
          class="w-full!"
          aria-label="收款到期日"
        />
      )
    },
    {
      prop: 'ratio',
      label: '应收比例（%）',
      width: 135,
      align: 'right',
      formatter: (row) => (
        <ElInputNumber
          v-model={row.ratio}
          min={0}
          max={100}
          precision={2}
          controls={false}
          disabled={details.value.paymentPlanMode !== 'ratio'}
          class="w-full!"
          aria-label="应收比例"
        />
      )
    },
    {
      prop: 'amount',
      label: '应收金额（元）',
      width: 145,
      align: 'right',
      formatter: (row) => (
        <ElInputNumber
          v-model={row.amount}
          min={0}
          precision={2}
          controls={false}
          disabled={details.value.paymentPlanMode === 'ratio'}
          class="w-full!"
          aria-label="应收金额"
        />
      )
    },
    {
      prop: 'excessRatio',
      label: '预收允超比例（%）',
      width: 155,
      align: 'right',
      formatter: (row) => (
        <ElInputNumber
          v-model={row.excessRatio}
          min={0}
          max={100}
          precision={2}
          controls={false}
          class="w-full!"
          aria-label="预收允超比例"
        />
      )
    },
    {
      prop: 'remark',
      label: '备注',
      minWidth: 160,
      formatter: (row) => <ElInput v-model={row.remark} maxlength={300} aria-label="收款计划备注" />
    },
    {
      prop: 'operation',
      label: '操作',
      width: 68,
      fixed: 'right',
      align: 'center',
      formatter: (row) => (
        <ArtIconButton
          icon="ri:delete-bin-line"
          label="移除收款计划"
          tone="danger"
          onClick={() => {
            const index = paymentPlans.value.indexOf(row)
            if (index >= 0) paymentPlans.value.splice(index, 1)
          }}
        />
      )
    }
  ])

  function addDeliveryPlan(): void {
    const today = dayjs().format('YYYY-MM-DD')
    deliveryPlans.value.push({
      id: crypto.randomUUID(),
      location: '',
      address: '',
      needDate: today,
      leadDays: 0,
      plannedDate: today,
      quantity: 1
    })
  }

  function updatePlannedDate(plan: ScmDeliveryPlan): void {
    plan.plannedDate = plan.needDate
      ? dayjs(plan.needDate)
          .subtract(Number(plan.leadDays) || 0, 'day')
          .format('YYYY-MM-DD')
      : ''
  }

  const deliveryColumns = computed<ColumnOption<ScmDeliveryPlan>[]>(() => [
    {
      prop: 'id',
      label: '#',
      width: 52,
      align: 'center',
      formatter: (row) => String(deliveryPlans.value.indexOf(row) + 1)
    },
    {
      prop: 'location',
      label: '收货地点',
      minWidth: 150,
      formatter: (row) => <ElInput v-model={row.location} maxlength={100} aria-label="收货地点" />
    },
    {
      prop: 'address',
      label: '收货地址',
      minWidth: 190,
      formatter: (row) => <ElInput v-model={row.address} maxlength={200} aria-label="收货地址" />
    },
    {
      prop: 'needDate',
      label: '要货日期',
      width: 170,
      formatter: (row) => (
        <ElDatePicker
          v-model={row.needDate}
          type="date"
          valueFormat="YYYY-MM-DD"
          class="w-full!"
          aria-label="要货日期"
          onUpdate:modelValue={() => nextTick(() => updatePlannedDate(row))}
        />
      )
    },
    {
      prop: 'leadDays',
      label: '运输提前期（天）',
      width: 145,
      align: 'right',
      formatter: (row) => (
        <ElInputNumber
          v-model={row.leadDays}
          min={0}
          max={365}
          precision={0}
          controls={false}
          class="w-full!"
          aria-label="运输提前期"
          onChange={() => updatePlannedDate(row)}
        />
      )
    },
    {
      prop: 'plannedDate',
      label: '计划发货日期',
      width: 135,
      formatter: (row) => row.plannedDate || '—'
    },
    {
      prop: 'quantity',
      label: '计划数量',
      width: 130,
      align: 'right',
      formatter: (row) => (
        <ElInputNumber
          v-model={row.quantity}
          min={0.001}
          precision={3}
          controls={false}
          class="w-full!"
          aria-label="计划数量"
        />
      )
    },
    {
      prop: 'remark',
      label: '备注',
      minWidth: 160,
      formatter: (row) => <ElInput v-model={row.remark} maxlength={300} aria-label="发货计划备注" />
    },
    {
      prop: 'operation',
      label: '操作',
      width: 68,
      fixed: 'right',
      align: 'center',
      formatter: (row) => (
        <ArtIconButton
          icon="ri:delete-bin-line"
          label="移除发货计划"
          tone="danger"
          onClick={() => {
            const index = deliveryPlans.value.indexOf(row)
            if (index >= 0) deliveryPlans.value.splice(index, 1)
          }}
        />
      )
    }
  ])

  function addClause(): void {
    clauses.value.push({ id: crypto.randomUUID(), title: '', content: '' })
  }

  async function loadShippingOrderLines(orderId: string): Promise<void> {
    const revision = ++shippingOrderRevision
    selectedShippingLines.value = []
    availableShippingLines.value = []
    const source = shippingOrderOptions.value.find((item) => item.id === orderId)
    if (!source) return
    shippingOrderLoading.value = true
    try {
      const remaining = await fetchScmRemainingSourceLines(source)
      if (revision !== shippingOrderRevision) return
      availableShippingLines.value = remaining
        .filter((line) => !lines.value.some((existing) => existing.sourceLineId === line.lineId))
        .map((line) => {
          const sourceLine = source.lines.find((item) => item.lineId === line.lineId)
          return {
            ...line,
            lineNo:
              sourceLine?.lineNo ??
              source.lines.findIndex((item) => item.lineId === line.lineId) + 1,
            salesQuantity: Number(sourceLine?.quantity ?? line.quantity),
            availableQuantity: Number(line.quantity),
            baseUnit: line.baseUnit || sourceLine?.baseUnit || ''
          }
        })
    } catch {
      if (revision === shippingOrderRevision)
        ElMessage.warning('订单剩余数量加载失败，请重新选择订单')
    } finally {
      if (revision === shippingOrderRevision) shippingOrderLoading.value = false
    }
  }

  async function openShippingOrderPicker(): Promise<void> {
    if (lines.value.length && !header.value.sourceId) {
      ElMessage.warning('当前为直接添加物料的发货单；请清空明细后再选单')
      return
    }
    if (!shippingOrderOptions.value.length) {
      ElMessage.warning('当前项目和客户暂无可发货的销售订单')
      return
    }
    selectedShippingOrderId.value = header.value.sourceId || ''
    selectedShippingLines.value = []
    availableShippingLines.value = []
    await shippingOrderPickerRef.value?.handleOpen(undefined, {
      title: '选单 · 销售订单明细',
      confirmText: '添加所选明细',
      loading: Boolean(selectedShippingOrderId.value),
      loadingText: '正在加载订单剩余明细…',
      onOpen: async (_data, api) => {
        try {
          if (selectedShippingOrderId.value) {
            await loadShippingOrderLines(selectedShippingOrderId.value)
          }
        } finally {
          api.setLoading(false)
        }
      },
      onConfirm: () => {
        const source = shippingOrderOptions.value.find(
          (item) => item.id === selectedShippingOrderId.value
        )
        if (!source || !selectedShippingLines.value.length) {
          ElMessage.warning('请选择销售订单及至少一行待发明细')
          return false
        }
        if (header.value.sourceId && header.value.sourceId !== source.id) {
          ElMessage.warning('一张发货通知单只能关联一张销售订单')
          return false
        }
        if (lines.value.length + selectedShippingLines.value.length > 200) {
          ElMessage.warning('发货明细最多 200 行')
          return false
        }
        header.value.sourceId = source.id
        header.value.projectId = source.projectId || ''
        header.value.customerId = source.customerId || ''
        header.value.currency = source.currency || 'CNY'
        header.value.deliveryDate ||= source.deliveryDate || ''
        lines.value = [
          ...lines.value,
          ...selectedShippingLines.value.map((line) => ({
            ...omit(line, ['salesQuantity', 'availableQuantity']),
            lineId: crypto.randomUUID(),
            sourceLineId: line.lineId,
            sourceDocumentId: source.id,
            sourceDocumentNo: source.documentNo,
            sourceLineNo: line.lineNo,
            deliveredQuantity: 0,
            outboundQuantity: 0,
            returnQuantity: 0
          }))
        ]
        return true
      }
    })
  }

  async function openLoadingPicker(): Promise<void> {
    if (!header.value.tenantId || !header.value.projectId || !header.value.customerId) {
      ElMessage.warning('请先选择所属租户、项目和客户')
      return
    }
    await loadingPickerRef.value?.open()
  }

  async function loadingPickerApi(params: DataSelectFetchParams) {
    const choices = await fetchScmLoadingChoices(
      header.value.tenantId,
      header.value.projectId,
      header.value.customerId,
      recordId.value || undefined
    )
    const keyword = (params.keyword ?? '').trim().toLocaleLowerCase()
    const filtered = choices.filter(
      (choice) =>
        choice.availableStock > 0 &&
        !lines.value.some(
          (line) =>
            line.sourceDocumentId === choice.noticeId &&
            line.sourceLineId === choice.noticeLineId &&
            line.stockBatchId === choice.stockBatchId
        ) &&
        (!keyword ||
          [
            choice.noticeNo,
            choice.line.materialCode,
            choice.line.materialDescription,
            choice.batchNo
          ].some((value) => value.toLocaleLowerCase().includes(keyword)))
    )
    const start = (params.page - 1) * params.pageSize
    return { data: filtered.slice(start, start + params.pageSize), total: filtered.length }
  }
  function confirmLoadingChoices(_keys: DataSelectModelValue, selected: ScmLoadingChoice[]): void {
    if (lines.value.length + selected.length > 200) {
      ElMessage.warning('装车明细最多 200 行')
      return
    }
    const added = buildLoadingLines(selected, lines.value, () => crypto.randomUUID())
    if (!added.length) {
      ElMessage.warning('所选明细没有剩余可装车数量')
      return
    }
    lines.value = [...lines.value, ...added]
  }

  function updateSalesperson(
    _id: string | string[] | undefined,
    rows: EmployeeIntegrationItem[]
  ): void {
    details.value.salesperson = rows[0]?.employeeName ?? ''
    details.value.salesDepartment = rows[0]?.organization?.organizationName ?? ''
  }

  function applySelectedLineSource(
    source: Pick<ScmSalesDocument, 'projectId' | 'customerId' | 'currency'>
  ): void {
    if (!header.value.projectId) header.value.projectId = source.projectId ?? ''
    if (!header.value.customerId) header.value.customerId = source.customerId ?? ''
    header.value.currency = source.currency || 'CNY'
  }

  async function applySource(id: string): Promise<void> {
    const source = sourceOptions.value.find((item) => item.id === id)
    if (!source) return
    const availableLines = await fetchScmRemainingSourceLines(source)
    if (header.value.sourceId !== id) return
    if (!availableLines.length) {
      ElMessage.warning('来源单据已无剩余数量，请选择其他单据')
      header.value.sourceId = ''
      return
    }
    header.value.projectId = source.projectId || ''
    header.value.customerId = source.customerId || ''
    header.value.currency = source.currency || 'CNY'
    if (kind.value === 'project_quotation') {
      Object.assign(details.value, source.details)
      header.value.documentDate = source.documentDate
      header.value.deliveryDate = source.deliveryDate || ''
      header.value.remark = source.remark || ''
    }
    lines.value = availableLines.map((line) => ({
      ...line,
      lineId: crypto.randomUUID(),
      sourceLineId: line.lineId,
      deliveredQuantity: 0,
      outboundQuantity: 0,
      returnQuantity: 0
    }))
    if (config.value.useFees) fees.value = source.fees.map((fee) => ({ ...fee }))
  }

  function validateDetails(): boolean {
    if (config.value.sourceRequired && !header.value.sourceId) {
      ElMessage.warning(`请选择${config.value.sourceLabel || '来源单据'}`)
      return false
    }
    if (
      kind.value === 'loading' &&
      lines.value.some((line) => !line.sourceDocumentId || !line.sourceLineId || !line.materialId)
    ) {
      ElMessage.warning('装车明细必须从发货通知单选取')
      activeTab.value = 'lines'
      return false
    }
    if (!lines.value.length) {
      ElMessage.warning(`请添加至少一行${kind.value === 'shipping_notice' ? '发货' : '物料'}明细`)
      activeTab.value = 'lines'
      return false
    }
    if (
      kind.value === 'shipping_notice' &&
      lines.value.some((line) => Boolean(line.sourceLineId) !== Boolean(header.value.sourceId))
    ) {
      ElMessage.warning('选单明细与直接添加的物料不能混用，请检查发货明细')
      activeTab.value = 'lines'
      return false
    }
    if (
      lines.value.some(
        (line) =>
          !line.materialDescription?.trim() ||
          (!(contractQuantityOptional.value && line.quantity == null) &&
            !Number.isFinite(line.quantity)) ||
          (!(contractQuantityOptional.value && line.quantity == null) &&
            Number(line.quantity) <= 0) ||
          !Number.isFinite(line.unitPrice) ||
          line.unitPrice < 0 ||
          line.taxRate < 0 ||
          line.taxRate > 100
      )
    ) {
      ElMessage.warning('请完整填写物料描述、正数数量、非负单价及 0–100% 税率')
      activeTab.value = 'lines'
      return false
    }
    if (
      (kind.value === 'sales_quotation' ||
        kind.value === 'sales_contract' ||
        kind.value === 'sales_order') &&
      lines.value.some(
        (line) =>
          (kind.value === 'sales_quotation' &&
            (!line.materialSource ||
              !materialSourceOptions.value.some(
                (option) => option.value === line.materialSource
              ))) ||
          !taxRateOptions.value.some((option) => Number(option.value) === line.taxRate)
      )
    ) {
      ElMessage.warning('请为每行参选有效的税率和物料来源')
      activeTab.value = 'lines'
      return false
    }
    if (
      (kind.value === 'sales_contract' || kind.value === 'sales_order') &&
      lines.value.some((line) => calculateContractLine(line).amount < 0)
    ) {
      ElMessage.warning('折扣额不能大于未税金额，请调整折扣率')
      activeTab.value = 'lines'
      return false
    }
    if (fees.value.some((fee) => !fee.expenseId || fee.amount < 0 || fee.cost < 0)) {
      ElMessage.warning('请完整填写费用明细')
      activeTab.value = 'fees'
      return false
    }
    if (paymentPlans.value.some((plan) => !plan.dueDate || plan.ratio < 0 || plan.amount < 0)) {
      ElMessage.warning('请完整填写收款计划')
      activeTab.value = 'payments'
      return false
    }
    if (
      deliveryPlans.value.some((plan) => !plan.needDate || !plan.plannedDate || plan.quantity <= 0)
    ) {
      ElMessage.warning('请完整填写发货计划')
      activeTab.value = 'deliveries'
      return false
    }
    if (
      clauses.value.some(
        (clause) =>
          !clause.title.trim() ||
          !clause.content.trim() ||
          (kind.value === 'sales_contract' &&
            !clauseOptions.value.some((option) => option.value === clause.title))
      )
    ) {
      ElMessage.warning('请完整填写合同条款')
      activeTab.value = 'clauses'
      return false
    }
    return true
  }

  async function handleSubmit(): Promise<boolean> {
    const revision = openRevision
    const submittingId = recordId.value
    if (referencesLoading.value || referenceError.value) {
      ElMessage.warning('请等待单据选项加载成功后再提交')
      return false
    }
    if (kind.value === 'sales_contract' && contractAttachmentsRef.value?.hasPendingUpload()) {
      ElMessage.warning('合同附件仍在上传，请完成后再保存')
      return false
    }
    try {
      const previousTab = activeTab.value
      if (kind.value === 'sales_contract' && activeTab.value !== 'base') {
        activeTab.value = 'base'
        await nextTick()
      }
      if (
        !(await (kind.value === 'sales_contract'
          ? contractFormRef.value?.validate()
          : headerFormRef.value?.validate()))
      )
        return false
      if (revision !== openRevision) return false
      if (
        kind.value !== 'project_quotation' &&
        config.value.fields.length &&
        kind.value !== 'sales_contract' &&
        !(await detailsFormRef.value?.validate())
      )
        return false
      if (revision !== openRevision) return false
      if (kind.value === 'sales_contract' && activeTab.value !== 'lines') {
        activeTab.value = 'lines'
        await nextTick()
      }
      if (kind.value !== 'project_quotation' && !(await quotationLineTableRef.value?.validate()))
        return false
      if (revision !== openRevision) return false
      if (kind.value === 'sales_contract') activeTab.value = previousTab
      if (config.value.useFees) {
        const feeValidation = await feeTableRef.value?.validate()
        if (revision !== openRevision) return false
        if (feeValidation && !feeValidation.valid) {
          activeTab.value = 'fees'
          ElMessage.warning(feeValidation.firstError?.message ?? '请完善费用明细')
          return false
        }
      }
      if (revision !== openRevision || referencesLoading.value || referenceError.value) return false
      if (!validateDetails()) return false
      if (kind.value === 'sales_contract' && contractAttachmentsRef.value?.hasPendingUpload()) {
        ElMessage.warning('合同附件仍在上传，请完成后再保存')
        return false
      }
      const cleanDetails: ScmDocumentDetails = { ...details.value }
      if (kind.value === 'shipping_notice') delete cleanDetails.constructionNo
      if (kind.value === 'sales_contract')
        cleanDetails.contractAttachments = [...header.value.contractAttachments]
      else delete cleanDetails.contractAttachments
      const payload: ScmSalesDocumentWrite = {
        tenantId: header.value.tenantId,
        kind: kind.value,
        documentNo: header.value.documentNo,
        documentTypeId: header.value.documentTypeId || null,
        projectId: header.value.projectId || null,
        customerId: header.value.customerId || null,
        sourceId: kind.value === 'loading' ? null : header.value.sourceId || null,
        documentDate: header.value.documentDate,
        deliveryDate: header.value.deliveryDate || null,
        currency: header.value.currency || 'CNY',
        details: cleanDetails,
        lines:
          kind.value === 'sales_contract' || kind.value === 'shipping_notice'
            ? lines.value.map((line) => {
                if (kind.value === 'shipping_notice' && line.sourceDocumentId) return line
                const material = materialOptions.value.find((item) => item.id === line.materialId)
                return {
                  ...line,
                  auxiliaryQuantity:
                    contractAuxiliaryQuantity(line.quantity, material?.auxiliaryUnitId, material) ??
                    (kind.value === 'shipping_notice' ? undefined : line.auxiliaryQuantity),
                  auxiliaryUnit:
                    material?.auxiliaryUnit ??
                    (kind.value === 'shipping_notice' ? undefined : line.auxiliaryUnit),
                  auxiliaryQuantity2:
                    contractAuxiliaryQuantity(
                      line.quantity,
                      material?.auxiliaryUnit2Id,
                      material
                    ) ?? (kind.value === 'shipping_notice' ? undefined : line.auxiliaryQuantity2),
                  auxiliaryUnit2: material?.auxiliaryUnit2 ?? line.auxiliaryUnit2
                }
              })
            : lines.value,
        fees: fees.value,
        paymentPlans: paymentPlans.value,
        deliveryPlans: deliveryPlans.value,
        clauses: clauses.value,
        remark: header.value.remark
      }
      if (submittingId) await updateScmSalesDocument(submittingId, cloneDeep(payload))
      else await createScmSalesDocument(cloneDeep(payload))
      if (revision !== openRevision) return false
      emit('success', submittingId ? 'edit' : 'add')
      return true
    } catch {
      // API 边界已显示业务安全的错误，保留表单供用户修正。
      return false
    }
  }

  async function handleOpen(options: OpenOptions): Promise<void> {
    invalidateOpen()
    attachmentContextKey.value = crypto.randomUUID()
    const revision = openRevision
    preparing = true
    kind.value = options.kind
    copyMode.value = Boolean(options.copy)
    recordId.value = options.copy ? undefined : options.record?.id
    tenantOptions.value = options.tenantOptions
    Object.assign(header.value, initialHeader(), options.record ?? {}, {
      tenantId:
        options.record?.tenantId ?? options.effectiveTenantId ?? defaultWriteTenantId.value ?? '',
      documentNo: options.copy ? '' : (options.record?.documentNo ?? ''),
      documentTypeId: options.record?.documentTypeId ?? '',
      projectId: options.record?.projectId ?? '',
      customerId: options.record?.customerId ?? '',
      sourceId: options.copy ? '' : (options.record?.sourceId ?? ''),
      deliveryDate: options.record?.deliveryDate ?? '',
      remark: options.record?.remark ?? '',
      contractAttachments:
        options.kind === 'sales_contract'
          ? cloneDeep(options.record?.details.contractAttachments ?? [])
          : []
    })
    for (const key of Object.keys(details.value))
      delete details.value[key as keyof ScmDocumentDetails]
    Object.assign(details.value, options.record?.details ?? {})
    selectedSalesperson.value = details.value.salespersonId
      ? [
          {
            id: details.value.salespersonId,
            tenantId: header.value.tenantId,
            employeeNo: '',
            employeeName: details.value.salesperson || '',
            employmentStatus: 'active'
          }
        ]
      : []
    if (kind.value === 'sales_quotation') details.value.quotationScene = 'standard'
    if (kind.value === 'sales_quotation' && !details.value.quotationQuantity)
      details.value.quotationQuantity = 1
    if (options.copy) delete details.value.automationResult
    if (config.value.usePaymentPlans && !details.value.paymentPlanMode)
      details.value.paymentPlanMode = 'amount'
    lines.value =
      options.record?.lines.map((line, index) => ({
        ...line,
        lineNo: kind.value === 'sales_quotation' ? (line.lineNo ?? (index + 1) * 10) : line.lineNo,
        lineId: options.copy ? crypto.randomUUID() : line.lineId,
        ...(options.copy && kind.value === 'sales_order'
          ? {
              sourceDocumentId: undefined,
              sourceDocumentNo: options.record?.documentNo,
              sourceLineId: line.lineId,
              sourceLineNo: index + 1
            }
          : {})
      })) ?? []
    if (options.copy && kind.value === 'shipping_notice' && options.record?.sourceId)
      lines.value = []
    loadingSeed =
      kind.value === 'loading' && options.initialSource
        ? {
            source: options.initialSource,
            lineIds: options.sourceLines?.map((line) => line.lineId)
          }
        : undefined
    if (options.initialSource) {
      header.value.tenantId = options.initialSource.tenantId
      header.value.projectId = options.initialSource.projectId ?? ''
      header.value.customerId = options.initialSource.customerId ?? ''
      header.value.currency = options.initialSource.currency
      header.value.deliveryDate = options.initialSource.deliveryDate || ''
      Object.assign(details.value, options.initialSource.details)
      if (kind.value !== 'loading') {
        header.value.sourceId = options.initialSource.id
        lines.value = (options.sourceLines ?? options.initialSource.lines).map((line) => ({
          ...line,
          lineId: crypto.randomUUID(),
          sourceLineId: line.lineId,
          sourceDocumentId: options.initialSource?.id,
          sourceDocumentNo: options.initialSource?.documentNo,
          sourceLineNo: line.lineNo,
          deliveredQuantity: 0,
          outboundQuantity: 0,
          returnedQuantity: 0
        }))
      }
    }
    fees.value = options.record?.fees.map((fee) => ({ ...fee })) ?? []
    paymentPlans.value =
      options.record?.paymentPlans.map((plan) => ({
        ...plan,
        id: options.copy ? crypto.randomUUID() : plan.id
      })) ?? []
    deliveryPlans.value =
      options.record?.deliveryPlans.map((plan) => ({
        ...plan,
        id: options.copy ? crypto.randomUUID() : plan.id
      })) ?? []
    clauses.value =
      options.record?.clauses.map((clause) => ({
        ...clause,
        id: options.copy ? crypto.randomUUID() : clause.id
      })) ?? []
    activeTab.value = kind.value === 'sales_contract' ? 'base' : 'lines'
    await nextTick()
    if (revision !== openRevision) return
    preparing = false
    await dialogRef.value?.handleOpen(options, {
      title: options.copy
        ? `复制${config.value.title} · ${options.record?.documentNo || ''}`
        : options.record
          ? `编辑${config.value.title} · ${options.record.documentNo}`
          : `新增${config.value.title}`,
      confirmText: recordId.value ? '保存更改' : '创建单据',
      onConfirm: handleSubmit,
      onClose: invalidateOpen,
      onOpen: async () => {
        headerFormRef.value?.clearValidate()
        detailsFormRef.value?.clearValidate()
        contractFormRef.value?.clearValidate()
        await loadReferences(header.value.tenantId)
        if (revision !== openRevision || referenceError.value) return
      },
      dialogProps: { closeOnClickModal: false }
    })
  }

  watch(
    () => header.value.tenantId,
    (tenantId, previous) => {
      if (preparing || tenantId === previous) return
      openRevision += 1
      header.value.projectId = ''
      header.value.documentTypeId = ''
      header.value.customerId = ''
      header.value.sourceId = ''
      header.value.contractAttachments = []
      attachmentContextKey.value = crypto.randomUUID()
      details.value.salespersonId = undefined
      details.value.salesperson = ''
      selectedSalesperson.value = []
      lines.value = []
      fees.value = []
      void loadReferences(tenantId)
    }
  )
  watch(
    () => header.value.projectId,
    (projectId) => {
      if (preparing || header.value.sourceId) return
      const project = projectOptions.value.find((item) => item.id === projectId)
      if (project?.customerId) header.value.customerId = project.customerId
      if (projectId)
        details.value.plannedProjectName = project?.projectName ?? details.value.plannedProjectName
    }
  )
  watch(
    () => header.value.sourceId,
    (sourceId) => {
      if (!preparing && sourceId && kind.value !== 'shipping_notice' && kind.value !== 'loading')
        void applySource(sourceId)
    }
  )
  watch(
    () => lines.value.length,
    (count) => {
      if (!preparing && kind.value === 'shipping_notice' && !count) header.value.sourceId = ''
    }
  )

  watch(
    [() => details.value.paymentPlanMode, previewTotal, paymentPlans],
    () => {
      const total = previewTotal.value
      for (const plan of paymentPlans.value) {
        if (details.value.paymentPlanMode === 'ratio') {
          const amount = Math.round(total * plan.ratio) / 100
          if (plan.amount !== amount) plan.amount = amount
        } else if (details.value.paymentPlanMode === 'amount') {
          const ratio = total > 0 ? Math.round((plan.amount / total) * 10000) / 100 : 0
          if (plan.ratio !== ratio) plan.ratio = ratio
        }
      }
    },
    { deep: true }
  )

  defineExpose({ handleOpen })
</script>
