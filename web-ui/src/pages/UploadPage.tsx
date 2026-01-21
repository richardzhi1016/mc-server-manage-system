import { useState } from 'react'

function UploadPage() {
  const [isDragOver, setIsDragOver] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState('')
  const [uploadResult, setUploadResult] = useState<{
    original_filename?: string
    files_extracted?: number
  } | null>(null)

  const acceptedTypes = ['.7z', '.7zip']

  const validateFile = (file: File): boolean => {
    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase()
    const isValidType = acceptedTypes.includes(fileExtension)

    if (!isValidType) {
      setErrorMessage(`不支持的文件格式。请上传 ${acceptedTypes.join(' 或 ')} 格式的文件。`)
      setUploadStatus('error')
      return false
    }

    return true
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)

    const files = e.dataTransfer.files
    if (files.length > 0) {
      const file = files[0]
    if (validateFile(file)) {
      setSelectedFile(file)
      setUploadStatus('idle')
      setErrorMessage('')
      setUploadResult(null)
    }
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      const file = files[0]
    if (validateFile(file)) {
      setSelectedFile(file)
      setUploadStatus('idle')
      setErrorMessage('')
      setUploadResult(null)
    }
    }
  }

  const uploadFile = async () => {
    if (!selectedFile) return

    setIsUploading(true)
    setUploadProgress(0)
    setUploadStatus('idle')
    setErrorMessage('')

    const formData = new FormData()
    formData.append('file', selectedFile)

    // 使用 XMLHttpRequest 来支持上传进度
    const xhr = new XMLHttpRequest()

    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) {
        const progress = Math.round((event.loaded / event.total) * 100)
        setUploadProgress(progress)
      }
    })

    xhr.addEventListener('load', () => {
      setIsUploading(false)
      if (xhr.status === 200) {
        try {
          const response = JSON.parse(xhr.responseText)
          setUploadResult({
            original_filename: response.original_filename,
            files_extracted: response.files_extracted
          })
          setUploadStatus('success')
        } catch {
          setUploadStatus('error')
          setErrorMessage('服务器响应格式错误')
        }
      } else {
        try {
          const errorResponse = JSON.parse(xhr.responseText)
          setUploadStatus('error')
          setErrorMessage(errorResponse.error || '上传失败')
        } catch {
          setUploadStatus('error')
          setErrorMessage(`上传失败 (HTTP ${xhr.status})`)
        }
      }
    })

    xhr.addEventListener('error', () => {
      setIsUploading(false)
      setUploadStatus('error')
      setErrorMessage('网络错误，请检查连接')
    })

    xhr.addEventListener('abort', () => {
      setIsUploading(false)
      setUploadStatus('error')
      setErrorMessage('上传被取消')
    })

    // 配置请求
    xhr.open('POST', 'http://localhost:5000/api/upload-package')
    xhr.send(formData)
  }

  const resetUpload = () => {
    setSelectedFile(null)
    setUploadProgress(0)
    setIsUploading(false)
    setUploadStatus('idle')
    setErrorMessage('')
    setUploadResult(null)
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <header className="text-center mb-8">
        <h2 className="text-gray-900 mb-2 font-semibold">上传服务器压缩包</h2>
        <p className="text-gray-600 text-lg font-normal">上传您的Minecraft服务器压缩包，我们将为您自动解压</p>
      </header>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 transition-shadow duration-250 hover:shadow-md" role="region" aria-label="文件上传区域">
        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-all duration-150 bg-gray-50 relative mb-6 cursor-pointer ${
            isDragOver ? 'border-indigo-500 bg-indigo-50 scale-101' : 'border-gray-300'
          } ${
            uploadStatus === 'error' ? 'border-red-500 bg-red-50' : ''
          } ${
            uploadStatus === 'success' ? 'border-emerald-500 bg-emerald-50' : ''
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          role="button"
          tabIndex={0}
          aria-label="拖拽文件到此处或点击选择文件"
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              document.getElementById('file-input')?.click()
            }
          }}
        >
          <div className="min-h-[200px] flex flex-col justify-center items-center">
            {selectedFile ? (
              <div className="flex flex-col items-center w-full">
                <div className="w-12 h-12 mb-4 text-indigo-500 flex-shrink-0 bg-contain bg-no-repeat bg-center" style={{backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke-width='1.5' stroke='currentColor'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m6.621 6.621-2.121 2.12a1.125 1.125 0 0 1-1.591 0l-2.121-2.12a1.125 1.125 0 0 1 1.591-1.591L9 9.879V4.5m.75 9.75h9a3 3 0 0 1 3 3v2.25' /%3E%3C/svg%3E\")"}} aria-hidden="true"></div>
                <div className="text-center mb-4">
                  <h3 className="text-gray-900 m-0 mb-1 text-lg font-semibold">{selectedFile.name}</h3>
                  <p className="text-gray-600 m-0 text-sm font-medium">{formatFileSize(selectedFile.size)}</p>
                </div>

                {isUploading && (
                  <div className="w-full max-w-75 mb-4" role="progressbar" aria-valuenow={uploadProgress} aria-valuemin={0} aria-valuemax={100}>
                    <div className="w-full h-2 bg-gray-200 rounded-sm overflow-hidden mb-2">
                      <div
                        className="h-full bg-gradient-to-r from-indigo-500 to-indigo-600 transition-all duration-250 rounded-sm"
                        style={{ width: `${uploadProgress}%` }}
                      ></div>
                    </div>
                    <span className="text-sm text-gray-700 font-semibold text-center">{uploadProgress}% 已完成</span>
                  </div>
                )}

                {uploadStatus === 'success' && uploadResult && (
                  <div className="py-3 px-4 rounded-md text-sm font-medium text-center mt-4 w-full max-w-100 flex items-center justify-center gap-2 bg-emerald-50 text-emerald-800 border border-emerald-500" role="status" aria-live="polite">
                    <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                    </svg>
                    文件上传并解压成功！
                    <br />
                    <small>
                      原始文件名: {uploadResult.original_filename}
                      {uploadResult.files_extracted !== undefined && (
                        <> • 解压文件数: {uploadResult.files_extracted}</>
                      )}
                    </small>
                  </div>
                )}

                {uploadStatus === 'error' && (
                  <div className="py-3 px-4 rounded-md text-sm font-medium text-center mt-4 w-full max-w-100 flex items-center justify-center gap-2 bg-red-50 text-red-800 border border-red-500" role="alert" aria-live="assertive">
                    <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
                    </svg>
                    {errorMessage}
                  </div>
                )}
              </div>
            ) : (
              <>
                <div className="w-12 h-12 mb-4 text-gray-400 flex-shrink-0 bg-contain bg-no-repeat bg-center" style={{backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke-width='1.5' stroke='currentColor'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='M12 16.5V9.75m0 0 3 3m-3-3-3 3M6.75 19.5a4.5 4.5 0 0 1-1.41-8.775 5.25 5.25 0 0 1 10.233-2.33 3 3 0 0 1 3.758 3.848A3.752 3.752 0 0 1 18 19.5H6.75Z' /%3E%3C/svg%3E\")"}} aria-hidden="true"></div>
                <h3 className="text-gray-900 m-0 mb-2 text-xl font-semibold">拖拽文件到此处或点击选择</h3>
                <p className="text-gray-600 m-0 text-base">支持 7z 和 7zip 格式</p>
              </>
            )}
          </div>

          <input
            type="file"
            accept={acceptedTypes.join(',')}
            onChange={handleFileSelect}
            className="absolute opacity-0 w-full h-full cursor-pointer"
            id="file-input"
            aria-label="选择要上传的文件"
          />
          <label htmlFor="file-input" className="inline-flex items-center gap-2 py-2 px-3 bg-gray-100 text-gray-700 rounded-md cursor-pointer text-sm font-medium transition-all duration-150 border-2 border-dashed border-gray-300 mt-4 hover:bg-gray-200 hover:border-gray-400">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
              <polyline points="14,2 14,8 20,8"/>
            </svg>
            选择文件
          </label>
        </div>

        <div className="flex gap-4 justify-center flex-wrap">
          {selectedFile && !isUploading && uploadStatus !== 'success' && (
            <button
              className="py-3 px-6 bg-indigo-500 text-white border-none rounded-md text-base font-semibold cursor-pointer transition-all duration-150 min-w-30 hover:bg-indigo-600 hover:-translate-y-0.5 hover:shadow-md disabled:bg-gray-300 disabled:cursor-not-allowed disabled:transform-none"
              onClick={uploadFile}
              disabled={isUploading}
              aria-describedby="upload-help"
            >
              {isUploading ? '上传中...' : '开始上传'}
            </button>
          )}

          {(uploadStatus === 'success' || uploadStatus === 'error') && (
            <button
              className="py-3 px-6 bg-white text-gray-700 border-2 border-gray-300 rounded-md text-base font-semibold cursor-pointer transition-all duration-150 min-w-30 hover:bg-gray-50 hover:border-gray-400 disabled:bg-gray-100 disabled:cursor-not-allowed disabled:text-gray-400"
              onClick={resetUpload}
              aria-label="重新选择文件"
            >
              上传其他文件
            </button>
          )}
        </div>

        <div id="upload-help" className="sr-only">
          选择一个 7z 或 7zip 格式的 Minecraft 服务器压缩包进行上传
        </div>
      </div>
    </div>
  )
}

export default UploadPage