<template>
  <ArtSectionCard
    title="合同附件"
    :subtitle="
      readonly
        ? '查看合同关联文件，可预览或下载。'
        : '单个文件不超过 20 MB；移除只解除本合同关联，保存后生效。'
    "
    preserve-content-structure
  >
    <template v-if="!readonly" #actions>
      <ArtUploadFile
        :key="contextKey"
        ref="uploadRef"
        title="上传附件"
        :resource-tenant-id="tenantId"
        :disabled="!tenantId || modelValue.length >= MAX_ATTACHMENTS"
        :limit="MAX_ATTACHMENTS - modelValue.length"
        multiple
        :show-file-list="false"
        :show-tip="false"
        inline
        @resource-change="handleResourceChange"
      />
    </template>
    <ArtTable
      :data="modelValue"
      :columns="columns"
      :pagination="undefined"
      :show-table-header="false"
      empty-height="160px"
    />
  </ArtSectionCard>
</template>

<script setup lang="tsx">
  import { ElMessage } from 'element-plus'
  import BusinessAttachmentRowActions from '@/components/business/business-attachment-row-actions/index.vue'
  import ArtUploadFile from '@/components/core/forms/art-upload-file/index.vue'
  import { attachmentTableLink } from '@/components/core/media/art-file-viewer/table-link'
  import ArtSectionCard from '@/components/core/surfaces/art-section-card/index.vue'
  import ArtTable from '@/components/core/tables/art-table/index.vue'
  import { useDraftAttachmentRemoval } from '@/hooks/core/useDraftAttachmentRemoval'
  import type { ColumnOption } from '@/types'
  import { getFileExtension } from '@/utils/file'
  import { formatSize } from '@/utils/file/format-size'
  import type { ScmContractAttachment } from '@scm/api'

  defineOptions({ name: 'ScmContractAttachments' })
  const MAX_ATTACHMENTS = 50

  const props = defineProps<{
    modelValue: ScmContractAttachment[]
    tenantId: string
    contextKey: string
    readonly?: boolean
  }>()
  const emit = defineEmits<{ 'update:modelValue': [value: ScmContractAttachment[]] }>()
  const uploadRef = ref<{ hasPendingUpload: () => boolean }>()

  const removeAttachment = useDraftAttachmentRemoval<ScmContractAttachment>({
    getAttachments: () => props.modelValue,
    setAttachments: (rows) => emit('update:modelValue', rows),
    canRemove: () => !props.readonly,
    getContext: () => [props.contextKey, props.tenantId],
    action: '移除'
  })

  const columns = computed<ColumnOption<ScmContractAttachment>[]>(() => [
    { type: 'globalIndex', label: '序号', width: 72 },
    {
      prop: 'name',
      label: '附件名称',
      minWidth: 220,
      showOverflowTooltip: true,
      link: attachmentTableLink
    },
    {
      prop: 'fileType',
      label: '格式类型',
      width: 120,
      dict: { code: 'FILE_EXTENSION_LABEL_MAP', display: 'text' }
    },
    {
      prop: 'fileSize',
      label: '附件大小',
      width: 120,
      formatter: (row) => formatSize(row.fileSize)
    },
    {
      prop: 'operation',
      label: '操作',
      width: props.readonly ? 104 : 144,
      fixed: 'right',
      formatter: (row) => (
        <BusinessAttachmentRowActions
          file={row}
          removable={!props.readonly}
          removeLabel="移除附件"
          onRemove={() => void removeAttachment(row)}
        />
      )
    }
  ])

  function handleResourceChange(resources: Api.DataCenter.Resources.ResourceListItem[]): void {
    if (props.readonly || !props.tenantId) return
    const tenantResources = resources.filter(
      (resource) => !resource.tenantId || resource.tenantId === props.tenantId
    )
    if (tenantResources.length !== resources.length) {
      ElMessage.error('附件所属租户与合同不一致，请重新选择')
      return
    }
    const additions = tenantResources
      .filter((resource) => Boolean(resource.url))
      .filter((resource) => !props.modelValue.some((attachment) => attachment.url === resource.url))
      .map((resource) => {
        const name = resource.originName || resource.objectName || '附件'
        return {
          name,
          url: resource.url ?? '',
          fileType: getFileExtension(name, resource.suffix),
          fileSize: resource.sizeByte ?? 0
        }
      })
    const remaining = MAX_ATTACHMENTS - props.modelValue.length
    if (additions.length > remaining) ElMessage.warning('每份合同最多关联 50 个附件')
    if (remaining > 0 && additions.length)
      emit('update:modelValue', [...props.modelValue, ...additions.slice(0, remaining)])
    else if (resources.length && remaining > 0) ElMessage.info('该附件已在当前合同中，无需重复添加')
  }

  defineExpose({ hasPendingUpload: () => uploadRef.value?.hasPendingUpload() ?? false })
</script>
