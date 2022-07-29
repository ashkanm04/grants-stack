import { Fragment, useEffect, useRef, useState } from "react"
import { Dialog, Transition } from "@headlessui/react"
import { Button } from "./styles";


interface ModalProps {
  title?: string;
  body?: string;
  cancelButtonText?: string;
  confirmButtonText?: string;
  isOpen: boolean;
  confirmButtonAction: () => void;
  cancelButtonAction?: () => void;
}


export default function ConfirmationModal(
  {
    title = "Please Confirm Decision",
    cancelButtonText = "Cancel",
    confirmButtonText = "Confirm",
    cancelButtonAction = () => setOpen(false),
    ...props
  }: ModalProps
) {

  const [open, setOpen] = useState(false)

  const cancelButtonRef = useRef(null)

  useEffect(() => {
    setOpen(props.isOpen)
  }, [props.isOpen])

  return (
    <Transition.Root show={open} as={Fragment}>
      <Dialog as="div" className="relative z-10" initialFocus={cancelButtonRef} onClose={setOpen}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" />
        </Transition.Child>

        <div className="fixed z-10 inset-0 overflow-y-auto">
          <div className="flex items-end sm:items-center justify-center min-h-full p-4 text-center sm:p-0">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
              enterTo="opacity-100 translate-y-0 sm:scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 translate-y-0 sm:scale-100"
              leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
            >
              <Dialog.Panel className="relative bg-white px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:max-w-lg sm:w-full sm:p-6">
                <div className="sm:flex sm:items-start">
                  <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                    <Dialog.Title as="h3" className="text-base leading-6 font-semibold text-grey-500">
                      {title}
                    </Dialog.Title>
                    <div className="mt-2">
                      <p className="text-sm text-grey-400">
                        {props.body}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
                  <Button
                    type="button"
                    className="w-full inline-flex text-sm sm:ml-3 sm:w-auto"
                    onClick={props.confirmButtonAction}
                  >
                    {confirmButtonText}
                  </Button>
                  <Button
                    type="button"
                    $variant="outline"
                    className="w-full inline-flex text-sm sm:ml-3 sm:w-auto"
                    onClick={cancelButtonAction}
                    ref={cancelButtonRef}
                  >
                    {cancelButtonText}
                  </Button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition.Root>
  )
}