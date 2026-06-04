import { Component, OnInit } from '@angular/core'
import { MatButtonModule } from '@angular/material/button'
import { signal, computed, effect, inject } from '@angular/core'
import { toSignal } from '@angular/core/rxjs-interop'
import { MatIconModule } from '@angular/material/icon'
import { MatGridListModule } from '@angular/material/grid-list'
import { MatRippleModule } from '@angular/material/core'
import { MatTooltipModule } from '@angular/material/tooltip'
import {MatSelectModule} from '@angular/material/select'
import {MatProgressSpinnerModule} from '@angular/material/progress-spinner'
import {MatSidenavModule} from '@angular/material/sidenav'
import {MatButtonToggleModule} from '@angular/material/button-toggle'
import {MatInputModule} from '@angular/material/input'
import {MatFormFieldModule} from '@angular/material/form-field'
import {MatSlideToggleModule} from '@angular/material/slide-toggle'
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms'
import {MatSnackBar} from '@angular/material/snack-bar'


@Component({
  selector: 'app-imageeditor',
  imports: [
    MatButtonModule,
    MatIconModule,
    MatGridListModule,
    MatTooltipModule,
    MatRippleModule,
    MatProgressSpinnerModule,
    MatSidenavModule,
    MatButtonToggleModule,
    MatSlideToggleModule,
    MatInputModule,
    MatFormFieldModule,
    ReactiveFormsModule,
    MatSelectModule
  ],
  templateUrl: './imageeditor.html',
  styleUrl: './imageeditor.css',
})
export class Imageeditor  {

  isOpenSettingsDrawer: boolean = false

  private snackBar = inject(MatSnackBar)
  private fb = inject(FormBuilder)

  form: FormGroup = this.fb.group({
    width: [undefined],
    height: [undefined],
    grayscale: [undefined],
    rotate: [undefined],
    blur: [undefined],
    red: [undefined],
    green: [undefined],
    blue: [undefined],
    flip: [undefined],
    removeAlpha: [undefined],
    ensureAlpha: [undefined],
    convertTo: [undefined]
  })


  localImage = signal<undefined | Blob>(undefined)
  remoteImage = signal<undefined | Blob>(undefined)

  isLoadingRemoteImage = signal<boolean>(false)

  localImageUrl = computed(() => {
    if (!this.localImage()) return undefined
    return URL.createObjectURL(this.localImage() as Blob)
  })

  remoteImageUrl = computed(() => {
    if (!this.remoteImage()) return undefined
    return URL.createObjectURL(this.remoteImage() as Blob)
  })

  public uploadFile() {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.addEventListener('change', () => {
      const file = input.files?.[0]
      // this.form.get('convertTo')?.setValue(file?.type.replace('image/', ''))
      if (file) {
        this.localImage.set(file)
      }
    }, {
      once: true
    })
    input.click()
  }

  public saveFile(blob: Blob | undefined) {
    if (!blob) return
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = a.href
    a.click()
    URL.revokeObjectURL(a.href)
  }


  constructor() {
    const formValue = toSignal(this.form.valueChanges, {
      initialValue: this.form.value
    })
    effect(() => {
      if (!this.localImage()) {
        this.remoteImage.set(undefined)
      } else {

        const currentForm = formValue()
        const fd = new FormData()
        fd.append('file', this.localImage() as Blob)
        this.isLoadingRemoteImage.set(true)
        const url = new URL('/api/v1/transform', window.location.origin)

        if (currentForm.flip) url.searchParams.set('flip', 'true')
        if (currentForm.width) url.searchParams.set('width', String(currentForm.width))
        if (currentForm.height) url.searchParams.set('height', String(currentForm.height))
        if (currentForm.blur) url.searchParams.set('blur', String(currentForm.blur))
        if (currentForm.rotate) url.searchParams.set('rotate', String(currentForm.rotate))
        if (currentForm.grayscale) url.searchParams.set('grayscale', String(currentForm.grayscale))

        if (currentForm.red != null) url.searchParams.set('r', String(currentForm.red))
        if (currentForm.green != null) url.searchParams.set('g', String(currentForm.green))
        if (currentForm.blue != null) url.searchParams.set('b', String(currentForm.blue))

        if (currentForm.removeAlpha) url.searchParams.set('removeAlpha', 'true')
        if (currentForm.ensureAlpha) url.searchParams.set('ensureAlpha', 'true')
        if (currentForm.convertTo) url.searchParams.set('convertTo', currentForm.convertTo)


        fetch(url, {
          method: 'POST',
          body: fd
        }).then(res => res.blob()).then(remoteFile => {
          this.remoteImage.set(remoteFile)
        }).finally(() => {
          this.isLoadingRemoteImage.set(false)
        })
      }
    })
  }

}
